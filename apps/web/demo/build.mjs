#!/usr/bin/env node
/**
 * Gera a DEMO estática (um único index.html com JS e CSS embutidos) do
 * PersonalPro Web reaproveitando o código real de apps/web/src, com uma API
 * simulada no navegador (apps/web/demo/mock).
 *
 * Uso:
 *   node apps/web/demo/build.mjs [--out caminho/index.html]
 *
 * Requer esbuild (não é dependência do repositório). Ele é procurado em:
 *   $ESBUILD_PATH, node_modules do repositório, /tmp/claude-0/demo-tools/node_modules.
 *   Para instalar fora do workspace:
 *     mkdir -p /tmp/claude-0/demo-tools && cd /tmp/claude-0/demo-tools && npm init -y && npm i esbuild@0.25
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const demoDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(demoDir, '..');
const repoRoot = path.resolve(webDir, '../..');
const srcDir = path.join(webDir, 'src');
const appDir = path.join(srcDir, 'app');
const sharedEntry = path.join(repoRoot, 'packages/shared/src/index.ts');
const globalsModule = path.join(demoDir, 'runtime/globals.ts');

const DEMO_API_URL = 'https://demo.personalpro.local';
const MAX_BYTES = 8 * 1024 * 1024;

const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const outFile = path.resolve(outArg >= 0 ? args[outArg + 1] : process.env.DEMO_OUT || path.join(demoDir, 'dist/index.html'));

const require = createRequire(path.join(webDir, 'package.json'));

async function loadEsbuild() {
  const candidates = [
    process.env.ESBUILD_PATH,
    'esbuild',
    '/tmp/claude-0/demo-tools/node_modules/esbuild',
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      const resolved = c.startsWith('/') ? require.resolve(c) : require.resolve(c);
      return (await import(pathToFileURL(resolved).href)).default ?? (await import(pathToFileURL(resolved).href));
    } catch {
      /* próximo */
    }
  }
  throw new Error('esbuild não encontrado. Veja as instruções no topo de apps/web/demo/build.mjs.');
}

// ---------------------------------------------------------------------------
// 1) Tabela de rotas a partir de src/app (page.tsx + layout.tsx)
// ---------------------------------------------------------------------------

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name.startsWith('_') || name.startsWith('@') || name === 'api') continue;
      out.push(...walk(full));
    } else out.push(full);
  }
  return out;
}

function buildRoutesModule() {
  const files = walk(appDir);
  const pages = files.filter((f) => /[/\\]page\.(tsx|ts|jsx|js)$/.test(f));
  const layoutAt = new Map(
    files.filter((f) => /[/\\]layout\.(tsx|ts|jsx|js)$/.test(f)).map((f) => [path.dirname(f), f]),
  );
  const imports = [];
  const ids = new Map();
  const idFor = (file) => {
    if (!ids.has(file)) {
      const id = `M${ids.size}`;
      ids.set(file, id);
      imports.push(`import ${id} from ${JSON.stringify(file)};`);
    }
    return ids.get(file);
  };
  const entries = [];
  for (const page of pages.sort()) {
    const dir = path.dirname(page);
    const rel = path.relative(appDir, dir);
    const parts = rel ? rel.split(path.sep) : [];
    const segments = parts.filter((p) => !(p.startsWith('(') && p.endsWith(')')));
    // Layouts do topo até a pasta da página (o layout raiz com <html>/<body> é substituído por main.tsx)
    const layouts = [];
    for (let i = 1; i <= parts.length; i++) {
      const d = path.join(appDir, ...parts.slice(0, i));
      if (layoutAt.has(d)) layouts.push(idFor(layoutAt.get(d)));
    }
    entries.push(
      `{ path: ${JSON.stringify(`/${segments.join('/')}`)}, segments: ${JSON.stringify(segments)}, page: ${idFor(page)}, layouts: [${layouts.join(', ')}] }`,
    );
  }
  return { source: `${imports.join('\n')}\nexport const routes = [\n  ${entries.join(',\n  ')}\n];\n`, count: entries.length, list: entries };
}

// ---------------------------------------------------------------------------
// 2) Reescritas de código para o frame de hospedagem
// ---------------------------------------------------------------------------

function skipString(src, i) {
  const q = src[i];
  i++;
  while (i < src.length && src[i] !== q) i += src[i] === '\\' ? 2 : 1;
  return i + 1;
}

function skipTemplate(src, i) {
  i++;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') i += 2;
    else if (c === '`') return i + 1;
    else if (c === '$' && src[i + 1] === '{') i = scanTo(src, i + 2, '') + 1;
    else i++;
  }
  return i;
}

/** Avança até um fechamento não pareado ou um caractere de parada no nível 0. */
function scanTo(src, i, stops) {
  const stack = [];
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'") {
      i = skipString(src, i);
      continue;
    }
    if (c === '`') {
      i = skipTemplate(src, i);
      continue;
    }
    if (c === '(' || c === '[' || c === '{') {
      stack.push(c);
      i++;
      continue;
    }
    if (c === ')' || c === ']' || c === '}') {
      if (!stack.length) return i;
      stack.pop();
      i++;
      continue;
    }
    if (!stack.length && stops.includes(c)) return i;
    i++;
  }
  return i;
}

/** `confirm(msg) && acao` → `__demoConfirm(msg, () => (acao))`. */
function rewriteConfirm(src, file, warnings) {
  const re = /(?<![\w$.])(?:window\.)?confirm\(/g;
  let out = '';
  let last = 0;
  let count = 0;
  let m;
  while ((m = re.exec(src))) {
    const argStart = m.index + m[0].length;
    const argEnd = scanTo(src, argStart, '');
    let j = argEnd + 1;
    while (/\s/.test(src[j])) j++;
    if (src.slice(j, j + 2) !== '&&') {
      warnings.push(`${path.relative(repoRoot, file)}: confirm() sem "&&" não reescrito`);
      continue;
    }
    j += 2;
    while (/\s/.test(src[j])) j++;
    const exprEnd = scanTo(src, j, ',;');
    const expr = src.slice(j, exprEnd).trimEnd();
    out += src.slice(last, m.index) + `__demoConfirm(${src.slice(argStart, argEnd)}, () => (${expr}))`;
    last = j + expr.length;
    re.lastIndex = last;
    count++;
  }
  return { code: out + src.slice(last), count };
}

const stats = { confirm: 0, location: 0, history: 0, qr: 0, download: 0 };
const warnings = [];

function transformSource(src, file) {
  let code = src;
  let touched = false;
  const sub = (re, rep, key) => {
    const n = (code.match(re) || []).length;
    if (n) {
      code = code.replace(re, rep);
      stats[key] += n;
      touched = true;
    }
  };
  sub(/\bwindow\.location\.(hash|search|pathname|origin|href)\b/g, '__demoLocation.$1', 'location');
  sub(/(?<![\w$.])(?:window\.)?history\.(replaceState|pushState)\(/g, '__demoHistory.$1(', 'history');
  sub(/`\$\{API_URL\}\/invites\/\$\{([^}]+)\}\/qrcode\.png`/g, '__demoQrUrl($1)', 'qr');
  if (/[/\\]lib[/\\]api\.ts$/.test(file)) {
    sub(
      /(export async function downloadJson\(path: string, filename: string\) \{)/g,
      '$1\n  return __demoDownloadJson(await api<unknown>(path), filename);',
      'download',
    );
  }
  const c = rewriteConfirm(code, file, warnings);
  if (c.count) {
    code = c.code;
    stats.confirm += c.count;
    touched = true;
  }
  if (!touched) return null;
  const header = `import { __demoLocation, __demoHistory, __demoConfirm, __demoQrUrl, __demoDownloadJson } from ${JSON.stringify(globalsModule)};\n`;
  // Mantém diretivas ('use client') no topo — são ignoradas fora do Next de qualquer forma.
  return header + code;
}

// ---------------------------------------------------------------------------
// 3) esbuild
// ---------------------------------------------------------------------------

const shim = (f) => path.join(demoDir, 'shims', f);
const NEXT_VIRTUAL = {
  'next/script': `export { Script as default } from ${JSON.stringify(shim('next-misc.tsx'))};`,
  'next/dynamic': `export { dynamic as default } from ${JSON.stringify(shim('next-misc.tsx'))};`,
  next: 'export {};',
};

function plugins(routesSource) {
  return [
    {
      name: 'demo-routes',
      setup(b) {
        b.onResolve({ filter: /^demo:routes$/ }, () => ({ path: 'demo:routes', namespace: 'demo-routes' }));
        b.onLoad({ filter: /.*/, namespace: 'demo-routes' }, () => ({ contents: routesSource, loader: 'js', resolveDir: webDir }));
      },
    },
    {
      name: 'demo-aliases',
      setup(b) {
        b.onResolve({ filter: /^@personalpro\/shared$/ }, () => ({ path: sharedEntry }));
        b.onResolve({ filter: /^socket\.io-client$/ }, () => ({ path: shim('socket-io-client.ts') }));
        b.onResolve({ filter: /^next(\/.*)?$/ }, (a) => {
          if (a.path === 'next/link') return { path: shim('next-link.tsx') };
          if (a.path === 'next/navigation') return { path: shim('next-navigation.ts') };
          if (a.path === 'next/image') return { path: shim('next-misc.tsx') };
          return { path: a.path, namespace: 'next-virtual' };
        });
        b.onLoad({ filter: /.*/, namespace: 'next-virtual' }, (a) => {
          const contents =
            NEXT_VIRTUAL[a.path] ??
            (a.path.startsWith('next/font/')
              ? `import { fontFactory } from ${JSON.stringify(shim('next-misc.tsx'))}; export default fontFactory; export const Inter = fontFactory; export const Geist = fontFactory; export const Geist_Mono = fontFactory;`
              : 'export {};');
          return { contents, loader: 'tsx', resolveDir: demoDir };
        });
      },
    },
    {
      name: 'demo-host-rewrites',
      setup(b) {
        b.onLoad({ filter: /[/\\]apps[/\\]web[/\\]src[/\\].*\.(tsx|ts)$/ }, (a) => {
          const src = readFileSync(a.path, 'utf8');
          const code = transformSource(src, a.path);
          return code === null ? undefined : { contents: code, loader: a.path.endsWith('.tsx') ? 'tsx' : 'ts', resolveDir: path.dirname(a.path) };
        });
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// 4) CSS (Tailwind v4) + tokens para data-theme do host
// ---------------------------------------------------------------------------

async function buildCss() {
  const postcss = require('postcss');
  const tailwind = require('@tailwindcss/postcss');
  const globalsPath = path.join(appDir, 'globals.css');
  const globals = readFileSync(globalsPath, 'utf8');
  const blocks = [...globals.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1].trim());
  if (blocks.length < 2) throw new Error('Não encontrei os blocos de tokens (:root) em globals.css');
  const [dark, light] = blocks;
  const themeOverrides = `
/* data-theme definido pelo host força o tema (espelha os tokens de globals.css) */
:root[data-theme="light"] {
  ${light}
}
:root[data-theme="dark"] {
  ${dark}
}
`;
  const demoCss = readFileSync(path.join(demoDir, 'demo.css'), 'utf8');
  const input = `${globals}\n${themeOverrides}\n${demoCss}`;
  const result = await postcss([tailwind({ base: webDir, optimize: { minify: true } })]).process(input, { from: globalsPath });
  return result.css;
}

// ---------------------------------------------------------------------------

async function main() {
  const t0 = Date.now();
  const esbuild = await loadEsbuild();
  const routes = buildRoutesModule();

  const result = await esbuild.build({
    entryPoints: [path.join(demoDir, 'main.tsx')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['es2020', 'chrome90', 'safari15', 'firefox90'],
    jsx: 'automatic',
    minify: true,
    legalComments: 'none',
    tsconfig: path.join(webDir, 'tsconfig.json'),
    logLevel: 'warning',
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.NEXT_PUBLIC_API_URL': JSON.stringify(DEMO_API_URL),
      'process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID': 'undefined',
      'process.env.NEXT_PUBLIC_APP_URL': '""',
    },
    banner: { js: 'var process=globalThis.process||{env:{}};' },
    plugins: plugins(routes.source),
  });
  const js = result.outputFiles[0].text.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
  const css = (await buildCss()).replace(/<\/(style)/gi, '<\\/$1');

  const html = `<title>PersonalPro</title>
<style>${css}</style>
<div id="root"></div>
<script>${js}</script>
`;
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, html);
  const bytes = Buffer.byteLength(html);
  console.log(`✔ ${path.relative(process.cwd(), outFile) || outFile}`);
  console.log(`  ${routes.count} rotas · JS ${(Buffer.byteLength(js) / 1024).toFixed(0)} KB · CSS ${(Buffer.byteLength(css) / 1024).toFixed(0)} KB · total ${(bytes / 1024 / 1024).toFixed(2)} MB · ${Date.now() - t0} ms`);
  console.log(`  reescritas: confirm ${stats.confirm} · location ${stats.location} · history ${stats.history} · QR ${stats.qr} · download ${stats.download}`);
  for (const w of warnings) console.warn(`  ⚠ ${w}`);
  if (bytes > MAX_BYTES) {
    console.error(`✖ O HTML passou de ${MAX_BYTES / 1024 / 1024} MB`);
    process.exit(1);
  }
  if (!existsSync(outFile)) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
