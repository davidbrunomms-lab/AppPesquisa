'use client';

import { CheckCircle2, Info, Trophy, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type ToastKind = 'success' | 'error' | 'info' | 'record';
interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastApi {
  show: (t: Omit<ToastItem, 'id'>, ms?: number) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((t: Omit<ToastItem, 'id'>, ms = 4000) => {
    const id = ++seq;
    setItems((prev) => [...prev.slice(-3), { ...t, id }]);
    setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), ms);
  }, []);

  const value = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, description) => show({ kind: 'success', title, description }),
      error: (title, description) => show({ kind: 'error', title, description }, 6000),
      info: (title, description) => show({ kind: 'info', title, description }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 sm:top-auto sm:bottom-6 sm:items-end"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'animate-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface p-3.5 shadow-card',
              t.kind === 'error' && 'border-danger/40',
              t.kind === 'success' && 'border-success/40',
              t.kind === 'record' && 'border-accent/60 bg-accent-soft',
              t.kind === 'info' && 'border-border',
            )}
          >
            <span className="mt-0.5 shrink-0">
              {t.kind === 'success' && <CheckCircle2 className="size-5 text-success" />}
              {t.kind === 'error' && <XCircle className="size-5 text-danger" />}
              {t.kind === 'info' && <Info className="size-5 text-info" />}
              {t.kind === 'record' && <Trophy className="size-5 text-accent-ink" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-muted">{t.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast fora do ToastProvider');
  return ctx;
}
