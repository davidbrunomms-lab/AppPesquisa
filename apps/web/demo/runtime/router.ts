/**
 * Roteador da demo baseado em hash (#/professor/alunos/<id>?tab=x#fragmento).
 * O estado em memória é a fonte da verdade; o hash da página é atualizado quando
 * possível (no frame de hospedagem só um "#token" simples sobrevive num link
 * compartilhado, então a demo sempre inicia na página inicial normal).
 */

export interface DemoLocation {
  pathname: string;
  search: string; // inclui "?" ou ""
  hash: string; // inclui "#" ou ""
}

type Listener = (loc: DemoLocation) => void;
const listeners = new Set<Listener>();

function parse(raw: string): DemoLocation {
  let s = raw || '/';
  if (!s.startsWith('/')) s = `/${s}`;
  let hash = '';
  const h = s.indexOf('#');
  if (h >= 0) {
    hash = s.slice(h);
    s = s.slice(0, h);
  }
  let search = '';
  const q = s.indexOf('?');
  if (q >= 0) {
    search = s.slice(q);
    s = s.slice(0, q);
  }
  const pathname = s.replace(/\/+$/, '') || '/';
  return { pathname, search: search === '?' ? '' : search, hash: hash === '#' ? '' : hash };
}

function fromWindowHash(): DemoLocation {
  try {
    const h = window.location.hash;
    if (h.startsWith('#/')) return parse(decodeURI(h.slice(1)));
  } catch {
    /* ignore */
  }
  return parse('/');
}

let current: DemoLocation = fromWindowHash();

export const getLocation = () => current;
export const toHref = (loc: DemoLocation) => `${loc.pathname}${loc.search}${loc.hash}`;

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function writeUrl(loc: DemoLocation, replace: boolean) {
  try {
    const url = `#${toHref(loc)}`;
    if (replace) window.history.replaceState(window.history.state, '', url);
    else window.history.pushState(null, '', url);
  } catch {
    /* frame sem acesso ao histórico — segue só em memória */
  }
}

function emit(prev: DemoLocation) {
  listeners.forEach((l) => l(current));
  if (prev.pathname === current.pathname && prev.search === current.search && prev.hash !== current.hash) {
    try {
      window.dispatchEvent(new Event('hashchange'));
    } catch {
      /* ignore */
    }
  }
}

/** Resolve um href do app (absoluto, "?q", "#frag" ou relativo) contra a rota atual. */
export function resolveHref(href: string): DemoLocation {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return current;
  if (href.startsWith('#')) return { ...current, hash: href === '#' ? '' : href };
  if (href.startsWith('?')) return { ...current, search: href, hash: '' };
  if (href.startsWith('/')) return parse(href);
  const base = current.pathname.endsWith('/') ? current.pathname : current.pathname.replace(/[^/]*$/, '');
  return parse(base + href);
}

export function navigate(href: string, opts: { replace?: boolean; scroll?: boolean } = {}) {
  if (/^(https?:|mailto:|tel:)/i.test(href)) {
    try {
      window.open(href, '_blank', 'noopener');
    } catch {
      /* ignore */
    }
    return;
  }
  const prev = current;
  current = resolveHref(href);
  writeUrl(current, Boolean(opts.replace));
  if (opts.scroll !== false && (prev.pathname !== current.pathname || prev.search !== current.search)) {
    try {
      window.scrollTo(0, 0);
    } catch {
      /* ignore */
    }
  }
  emit(prev);
}

export function back() {
  try {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
  } catch {
    /* ignore */
  }
  navigate('/', { replace: true });
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const prev = current;
    current = fromWindowHash();
    if (toHref(prev) !== toHref(current)) listeners.forEach((l) => l(current));
  });
}
