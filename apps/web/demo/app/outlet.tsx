/** Renderiza a rota atual com os layouts aninhados como o App Router do Next. */
import { routes, type DemoRoute } from 'demo:routes';
import { Component, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { ParamsContext } from '../shims/next-navigation';
import { getLocation, navigate, subscribe } from '../runtime/router';

interface Match {
  route: DemoRoute;
  params: Record<string, string>;
}

const specificity = (r: DemoRoute) => r.segments.map((s) => (s.startsWith('[') ? 1 : 2)).join('');
const ordered = [...routes].sort((a, b) => b.segments.length - a.segments.length || specificity(b).localeCompare(specificity(a)));

function match(pathname: string): Match | null {
  const parts = pathname.split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  for (const route of ordered) {
    const segs = route.segments;
    const catchAll = segs.length && /^\[\.\.\..+\]$/.test(segs[segs.length - 1]);
    if (!catchAll && segs.length !== parts.length) continue;
    if (catchAll && parts.length < segs.length - 1) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (/^\[\.\.\..+\]$/.test(s)) {
        params[s.slice(4, -1)] = parts.slice(i).join('/');
        break;
      }
      if (s.startsWith('[')) params[s.slice(1, -1)] = parts[i];
      else if (s !== parts[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}

function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="text-5xl font-semibold tracking-tight text-accent-ink">404</p>
        <p className="mt-2 text-muted">Página não encontrada.</p>
        <button className="mt-6 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg" onClick={() => navigate('/', { replace: true })}>
          Ir para o início
        </button>
      </div>
    </div>
  );
}

class Boundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null; key: string }> {
  state = { error: null as Error | null, key: this.props.resetKey };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  static getDerivedStateFromProps(props: { resetKey: string }, state: { key: string }) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (error.message === 'NEXT_NOT_FOUND') return <NotFound />;
    if (error.message.startsWith('NEXT_REDIRECT')) return null;
    return (
      <div className="grid min-h-[60dvh] place-items-center px-4 text-center">
        <div>
          <p className="font-semibold">Algo deu errado nesta tela.</p>
          <p className="mt-1 text-sm text-muted">{error.message}</p>
          <button className="mt-4 rounded-xl border border-border px-4 py-2 text-sm" onClick={() => this.setState({ error: null })}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }
}

export function RouterOutlet() {
  const loc = useSyncExternalStore(subscribe, getLocation, getLocation);
  const m = useMemo(() => match(loc.pathname), [loc.pathname]);
  const paramsPromise = useMemo(() => Promise.resolve(m?.params ?? {}), [m]);
  const searchPromise = useMemo(() => Promise.resolve(Object.fromEntries(new URLSearchParams(loc.search))), [loc.search]);
  if (!m) return <NotFound />;
  const Page = m.route.page;
  let tree: ReactNode = <Page key={loc.pathname} params={paramsPromise} searchParams={searchPromise} />;
  for (let i = m.route.layouts.length - 1; i >= 0; i--) {
    const Layout = m.route.layouts[i];
    tree = (
      <Layout key={`layout-${i}`} params={paramsPromise}>
        {tree}
      </Layout>
    );
  }
  return (
    <ParamsContext.Provider value={m.params}>
      <Boundary resetKey={loc.pathname}>{tree}</Boundary>
    </ParamsContext.Provider>
  );
}
