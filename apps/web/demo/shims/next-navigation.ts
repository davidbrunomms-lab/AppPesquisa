/** Shim de next/navigation sobre o roteador por hash da demo. */
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import { back, getLocation, navigate, subscribe } from '../runtime/router';

export const ParamsContext = createContext<Record<string, string>>({});

const router = {
  push: (href: string, opts?: { scroll?: boolean }) => navigate(href, { scroll: opts?.scroll }),
  replace: (href: string, opts?: { scroll?: boolean }) => navigate(href, { replace: true, scroll: opts?.scroll }),
  back: () => back(),
  forward: () => {
    try {
      window.history.forward();
    } catch {
      /* ignore */
    }
  },
  refresh: () => {
    /* sem servidor: nada a revalidar */
  },
  prefetch: () => Promise.resolve(),
};

export function useRouter() {
  return router;
}

function useLoc() {
  return useSyncExternalStore(subscribe, getLocation, getLocation);
}

export function usePathname() {
  return useLoc().pathname;
}

export function useSearchParams() {
  const { search } = useLoc();
  return useMemo(() => new URLSearchParams(search) as URLSearchParams & { readonly size: number }, [search]);
}

export function useParams<T extends Record<string, string | string[]> = Record<string, string>>(): T {
  return useContext(ParamsContext) as unknown as T;
}

export function useSelectedLayoutSegment() {
  return null;
}
export function useSelectedLayoutSegments() {
  return [] as string[];
}

class RedirectSignal extends Error {
  constructor(readonly href: string) {
    super(`NEXT_REDIRECT ${href}`);
  }
}

export function redirect(href: string): never {
  setTimeout(() => navigate(href, { replace: true }), 0);
  throw new RedirectSignal(href);
}
export const permanentRedirect = redirect;

export function notFound(): never {
  throw new Error('NEXT_NOT_FOUND');
}

export const RedirectType = { push: 'push', replace: 'replace' } as const;
export type ReadonlyURLSearchParams = URLSearchParams;
