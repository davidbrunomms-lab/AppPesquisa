'use client';

import { AlertTriangle, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import {
  forwardRef,
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

// ---------------------------------------------------------------------------
// Botões
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-95 active:brightness-90 font-semibold',
  secondary: 'bg-surface-2 text-fg hover:bg-surface-3 border border-border',
  outline: 'border border-border-strong text-fg hover:bg-surface-2',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger hover:bg-danger/20 border border-danger/30',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
  icon: 'size-9 rounded-lg justify-center',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
});

export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Cartões e layout
// ---------------------------------------------------------------------------

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('min-w-0 rounded-2xl border border-border bg-surface shadow-card', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">{icon}</span>}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-4 sm:p-5', className)}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'accent' | 'warning' | 'danger' | 'info';
  href?: string;
}) {
  const body = (
    <Card className={cn('h-full p-4 transition sm:p-5', href && 'hover:border-border-strong')}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {icon && (
          <span
            className={cn(
              'grid size-8 place-items-center rounded-lg',
              tone === 'accent' && 'bg-accent-soft text-accent-ink',
              tone === 'warning' && 'bg-warning-soft text-warning',
              tone === 'danger' && 'bg-danger-soft text-danger',
              tone === 'info' && 'bg-info-soft text-info',
              tone === 'default' && 'bg-surface-2 text-muted',
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="tabular mt-2 text-2xl font-semibold tracking-tight sm:text-[28px]">{value}</p>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

// ---------------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------------

const fieldBase =
  'w-full rounded-xl border border-border bg-surface-2 px-3.5 text-sm text-fg placeholder:text-subtle outline-none transition focus:border-accent/70 focus:ring-2 focus:ring-accent/20 disabled:opacity-60';

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-medium text-muted">
          {label}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; hint?: ReactNode; error?: string | null; wrapperClassName?: string }>(
  function Input({ label, hint, error, className, wrapperClassName, id, ...rest }, ref) {
    const auto = useId();
    const inputId = id ?? auto;
    const input = <input ref={ref} id={inputId} className={cn(fieldBase, 'h-11', className)} {...rest} />;
    if (!label && !hint && !error) return input;
    return (
      <Field label={label} hint={hint} error={error} htmlFor={inputId} className={wrapperClassName}>
        {input}
      </Field>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; hint?: ReactNode; wrapperClassName?: string }>(
  function Textarea({ label, hint, className, wrapperClassName, id, ...rest }, ref) {
    const auto = useId();
    const inputId = id ?? auto;
    const el = <textarea ref={ref} id={inputId} className={cn(fieldBase, 'min-h-24 py-2.5', className)} {...rest} />;
    if (!label && !hint) return el;
    return (
      <Field label={label} hint={hint} htmlFor={inputId} className={wrapperClassName}>
        {el}
      </Field>
    );
  },
);

export function Select({
  label,
  hint,
  options,
  placeholder,
  className,
  wrapperClassName,
  id,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  options: { value: string; label: string }[];
  placeholder?: string;
  wrapperClassName?: string;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  const el = (
    <select id={inputId} className={cn(fieldBase, 'h-11 appearance-none bg-[length:16px] pr-9', className)} style={{ backgroundImage: chevron, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
  if (!label && !hint) return el;
  return (
    <Field label={label} hint={hint} htmlFor={inputId} className={wrapperClassName}>
      {el}
    </Field>
  );
}
const chevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239aa2ab' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

export function Checkbox({ checked, onChange, children, id }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; id?: string }) {
  const auto = useId();
  return (
    <label htmlFor={id ?? auto} className="flex cursor-pointer items-start gap-2.5 text-sm text-muted">
      <input
        id={id ?? auto}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded accent-[var(--accent)]"
      />
      <span>{children}</span>
    </label>
  );
}

export function Chip({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition',
        active ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-surface-2 text-muted hover:text-fg',
        className,
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

type BadgeTone = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
export function Badge({ tone = 'default', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold',
        tone === 'default' && 'bg-surface-3 text-muted',
        tone === 'accent' && 'bg-accent-soft text-accent-ink',
        tone === 'success' && 'bg-success-soft text-success',
        tone === 'warning' && 'bg-warning-soft text-warning',
        tone === 'danger' && 'bg-danger-soft text-danger',
        tone === 'info' && 'bg-info-soft text-info',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-muted', className)} />;
}

export function LoadingBlock({ label = 'Carregando…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-12 text-sm text-muted', className)}>
      <Spinner />
      {label}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-2', className)} />;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-8 text-center">
      <AlertTriangle className="size-6 text-danger" />
      <p className="text-sm">{errorMessage(error)}</p>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-4 py-10 text-center', className)}>
      {icon && <div className="mb-1 grid size-11 place-items-center rounded-2xl bg-surface-2 text-muted">{icon}</div>}
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value, className, tone = 'accent' }: { value: number; className?: string; tone?: 'accent' | 'info' | 'warning' }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-3', className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', tone === 'accent' && 'bg-accent', tone === 'info' && 'bg-info', tone === 'warning' && 'bg-warning')}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function Avatar({ name, src, size = 40, className }: { name?: string | null; src?: string | null; size?: number; className?: string }) {
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-3 font-semibold text-muted ring-1 ring-border', className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? ''} className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Modal e abas
// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="animate-fade fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          'flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-border bg-surface shadow-2xl sm:rounded-2xl',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-lg',
          size === 'lg' && 'sm:max-w-2xl',
          size === 'xl' && 'sm:max-w-4xl',
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="-mr-1 grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg" aria-label="Fechar">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3.5 pb-safe">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: string; icon?: ReactNode; badge?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0', className)}>
      <div className="inline-flex min-w-full gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              'relative inline-flex h-10 shrink-0 items-center gap-1.5 px-3 text-sm font-medium transition',
              value === t.value ? 'text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {t.icon}
            {t.label}
            {t.badge}
            {value === t.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('inline-flex rounded-xl border border-border bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'h-8 flex-1 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition',
            value === o.value ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-border', className)} />;
}
