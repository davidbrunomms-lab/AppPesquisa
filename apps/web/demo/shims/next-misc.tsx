/** Shims mínimos para next/image, next/script, next/dynamic, next/font/* e "next". */
import { lazy, Suspense, type ComponentType, type ImgHTMLAttributes, type ReactNode } from 'react';

export default function Image({
  src,
  alt,
  fill: _fill,
  priority: _p,
  quality: _q,
  placeholder: _ph,
  blurDataURL: _b,
  loader: _l,
  unoptimized: _u,
  ...rest
}: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string | { src: string }; fill?: boolean; priority?: boolean; quality?: number; placeholder?: string; blurDataURL?: string; loader?: unknown; unoptimized?: boolean }) {
  return <img src={typeof src === 'string' ? src : (src as { src: string }).src} alt={alt ?? ''} {...rest} />;
}

export function Script({ children }: { children?: ReactNode; src?: string }) {
  void children;
  return null;
}

export function dynamic<P extends object>(loader: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>, opts?: { loading?: () => ReactNode }) {
  const Lazy = lazy(async () => {
    const m = await loader();
    return 'default' in (m as object) ? (m as { default: ComponentType<P> }) : { default: m as ComponentType<P> };
  });
  return function DynamicComponent(props: P) {
    return (
      <Suspense fallback={opts?.loading?.() ?? null}>
        <Lazy {...(props as any)} />
      </Suspense>
    );
  };
}

/** next/font/*: devolve classes vazias (a demo usa a pilha de fontes do sistema). */
export function fontFactory() {
  return { className: '', variable: '', style: { fontFamily: 'inherit' } };
}
