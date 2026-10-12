import type { AppointmentStatus, LinkStatus } from '@personalpro/shared';

export function initials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export const firstName = (name?: string | null) => (name ?? '').trim().split(/\s+/)[0] ?? '';

const dtf = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', opts);
const fDate = dtf({ day: '2-digit', month: '2-digit', year: 'numeric' });
const fShort = dtf({ day: '2-digit', month: 'short' });
const fTime = dtf({ hour: '2-digit', minute: '2-digit' });
const fDateTime = dtf({ day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const fWeekday = dtf({ weekday: 'long', day: '2-digit', month: 'long' });

const toDate = (d: string | Date) => (typeof d === 'string' ? new Date(d) : d);

export const fmtDate = (d?: string | Date | null) => (d ? fDate.format(toDate(d)) : '—');
export const fmtShort = (d?: string | Date | null) => (d ? fShort.format(toDate(d)).replace('.', '') : '—');
export const fmtTime = (d?: string | Date | null) => (d ? fTime.format(toDate(d)) : '—');
export const fmtDateTime = (d?: string | Date | null) => (d ? fDateTime.format(toDate(d)).replace('.', '') : '—');
export const fmtWeekdayLong = (d: string | Date) => {
  const s = fWeekday.format(toDate(d));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** "2026-09-14" (chave de dia) → "14/09". */
export const fmtDayKey = (key: string) => {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
};
/** "2026-09" → "set/26". */
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const fmtMonthKey = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]}/${String(y).slice(2)}`;
};
export const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function relativeDays(d?: string | null) {
  if (!d) return 'Nunca';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 30) return `Há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'Há 1 mês' : `Há ${months} meses`;
}

export const fmtNumber = (n?: number | null, digits = 1) =>
  n === null || n === undefined || Number.isNaN(n) ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: digits });

export const fmtKg = (n?: number | null, digits = 1) => (n === null || n === undefined ? '—' : `${fmtNumber(n, digits)} kg`);

export const fmtSigned = (n?: number | null, unit = '', digits = 1) => {
  if (n === null || n === undefined) return '—';
  const s = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${s}${Math.abs(n).toLocaleString('pt-BR', { maximumFractionDigits: digits })}${unit ? ` ${unit}` : ''}`;
};

export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAYS_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const LINK_STATUS_LABELS: Record<LinkStatus, string> = {
  ACTIVE: 'Ativo',
  PENDING: 'Pendente',
  INACTIVE: 'Inativo',
};

export const linkTone = (s: LinkStatus) => (s === 'ACTIVE' ? 'success' : s === 'PENDING' ? 'warning' : 'default') as 'success' | 'warning' | 'default';

export const appointmentTone = (s: AppointmentStatus) =>
  (
    ({ AVAILABLE: 'info', REQUESTED: 'warning', CONFIRMED: 'accent', CANCELED: 'danger', COMPLETED: 'success' }) as const
  )[s];

/** Data local → "YYYY-MM-DD" para <input type=date>. */
export function toInputDate(d: Date | string | null | undefined) {
  if (!d) return '';
  const x = toDate(d);
  return `${x.getFullYear()}-${`${x.getMonth() + 1}`.padStart(2, '0')}-${`${x.getDate()}`.padStart(2, '0')}`;
}
export function toInputTime(d: Date | string) {
  const x = toDate(d);
  return `${`${x.getHours()}`.padStart(2, '0')}:${`${x.getMinutes()}`.padStart(2, '0')}`;
}
/** "YYYY-MM-DD" + "HH:mm" locais → ISO UTC. */
export function combineLocal(date: string, time: string) {
  return new Date(`${date}T${time || '00:00'}:00`).toISOString();
}

export function startOfWeekLocal(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (x.getDay() + 6) % 7; // segunda-feira
  x.setDate(x.getDate() - diff);
  return x;
}
export function addDaysLocal(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
