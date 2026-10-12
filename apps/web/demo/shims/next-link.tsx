/** Shim de next/link: âncora que navega pelo roteador por hash da demo. */
import { forwardRef, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { navigate } from '../runtime/router';

type Href = string | { pathname?: string; query?: Record<string, string | number | undefined>; hash?: string };

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: Href;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean | null;
  shallow?: boolean;
  passHref?: boolean;
  legacyBehavior?: boolean;
  locale?: string | false;
  children?: ReactNode;
}

export function hrefToString(href: Href): string {
  if (typeof href === 'string') return href;
  const q = href.query
    ? Object.entries(href.query)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  return `${href.pathname ?? ''}${q ? `?${q}` : ''}${href.hash ? (href.hash.startsWith('#') ? href.hash : `#${href.hash}`) : ''}`;
}

const isExternal = (h: string) => /^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith('//');

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, replace, scroll, prefetch: _p, shallow: _s, passHref: _ph, legacyBehavior: _lb, locale: _l, onClick, target, children, ...rest },
  ref,
) {
  const to = hrefToString(href);
  const external = isExternal(to);
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || external) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (target && target !== '_self')) return;
    e.preventDefault();
    navigate(to, { replace, scroll });
  };
  return (
    <a ref={ref} href={external ? to : `#${to.startsWith('#') ? to.slice(1) : to}`} onClick={handle} target={target} {...rest}>
      {children}
    </a>
  );
});

export default Link;
