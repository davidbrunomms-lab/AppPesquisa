import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from './app-shell';

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/">
            <Logo />
          </Link>
          <nav className="flex gap-4 text-sm text-muted">
            <Link href="/privacidade" className="hover:text-fg">
              Privacidade
            </Link>
            <Link href="/termos" className="hover:text-fg">
              Termos
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">Última atualização: {updated}</p>
        <article className="legal mt-8 space-y-4 text-[15px] leading-relaxed text-muted [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-fg [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-fg [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:text-fg [&_a]:text-accent-ink [&_a]:underline [&_table]:w-full [&_table]:text-sm [&_td]:border-t [&_td]:border-border [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_th]:pb-2 [&_th]:text-left [&_th]:text-fg">
          {children}
        </article>
      </main>
    </div>
  );
}
