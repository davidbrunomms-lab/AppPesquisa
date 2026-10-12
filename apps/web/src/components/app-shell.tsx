'use client';

import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { Avatar, LoadingBlock } from './ui';

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** Item exibido na barra inferior (mobile). */
  primary?: boolean;
  badge?: number;
  exact?: boolean;
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <span className="grid size-8 place-items-center rounded-[10px] bg-accent text-accent-fg">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
          <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
        </svg>
      </span>
      {!compact && (
        <span className="text-[17px]">
          Personal<span className="text-accent-ink">Pro</span>
        </span>
      )}
    </span>
  );
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppShell({
  nav,
  areaLabel,
  headerActions,
  allowed,
  children,
}: {
  nav: NavItem[];
  areaLabel: string;
  headerActions?: ReactNode;
  allowed: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const primary = nav.filter((n) => n.primary);

  if (!allowed) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <LoadingBlock label="Verificando sessão…" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh lg:pl-[248px]">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-border bg-surface/60 backdrop-blur lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href={nav[0]?.href ?? '/'}>
            <Logo />
          </Link>
        </div>
        <p className="px-5 pb-2 pt-3 text-[11px] font-semibold tracking-wider text-subtle uppercase">{areaLabel}</p>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {nav.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition',
                  active ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2/60 hover:text-fg',
                )}
              >
                <span className={cn('[&>svg]:size-[18px]', active ? 'text-accent-ink' : 'text-subtle group-hover:text-fg')}>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {!!item.badge && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-fg">{item.badge}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar name={user?.name} src={user?.avatarUrl} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
            <button onClick={() => logout()} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg" aria-label="Sair" title="Sair">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Topbar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur-md lg:h-16 lg:px-8">
        <Link href={nav[0]?.href ?? '/'} className="lg:hidden">
          <Logo />
        </Link>
        <p className="hidden text-sm text-muted lg:block">{areaLabel}</p>
        <div className="flex items-center gap-1">{headerActions}</div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">{children}</main>

      {/* Navegação inferior (mobile) */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-xl items-stretch justify-around">
          {primary.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn('relative flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium', active ? 'text-fg' : 'text-subtle')}
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />}
                <span className={cn('relative [&>svg]:size-[21px]', active && 'text-accent-ink')}>
                  {item.icon}
                  {!!item.badge && <span className="absolute -top-1 -right-2 size-2 rounded-full bg-accent ring-2 ring-surface" />}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function HeaderIconLink({ href, label, icon, badge }: { href: string; label: string; icon: ReactNode; badge?: number }) {
  return (
    <Link href={href} aria-label={label} title={label} className="relative grid size-9 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg [&>svg]:size-[19px]">
      {icon}
      {!!badge && (
        <span className="absolute top-0.5 right-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] leading-4 font-bold text-accent-fg">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
}
