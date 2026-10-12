export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const pad = (n: number) => `${n}`.padStart(2, '0');

/** 22/09 */
export function fmtDayMonth(d: string | Date) {
  const date = new Date(d);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}
/** 22/09/2026 */
export function fmtDate(d: string | Date | null | undefined) {
  if (!d) return '—';
  const date = new Date(d);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}
/** 10:00 */
export function fmtTime(d: string | Date) {
  const date = new Date(d);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
/** Seg, 22/09 · 10:00 */
export function fmtDateTime(d: string | Date) {
  const date = new Date(d);
  return `${WEEKDAYS_SHORT[date.getDay()]}, ${fmtDayMonth(date)} · ${fmtTime(date)}`;
}
/** Data local "aaaa-mm-dd" a partir de uma data ISO de "data pura" (ex.: 1990-05-12T00:00:00Z). */
export function isoDateOnly(d: string | null | undefined) {
  return d ? d.slice(0, 10) : '';
}
/** dd/mm/aaaa → ISO (aaaa-mm-dd) ou null se inválida. */
export function parseBrDate(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m.map(Number) as unknown as number[];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCMonth() !== mo - 1) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}
export function isoToBrDate(iso: string | null | undefined) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
/** "aaaa-mm-dd" + "HH:mm" → Date local. */
export function combineLocal(dateKey: string, time: string): Date | null {
  const [y, m, d] = dateKey.split('-').map(Number);
  const tm = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!y || !m || !d || !tm) return null;
  return new Date(y, m - 1, d, Number(tm[1]), Number(tm[2]), 0, 0);
}
export function fmtNumber(n: number | null | undefined, decimals = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: decimals });
}
export function fmtKg(n: number | null | undefined) {
  return n === null || n === undefined ? '—' : `${fmtNumber(n)} kg`;
}
export function fmtMoney(cents: number, currency = 'BRL') {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency });
}
/** Converte texto com vírgula em número (ou undefined). */
export function parseNum(text: string | undefined | null): number | undefined {
  if (text === undefined || text === null) return undefined;
  const t = String(text).trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}
export function numToText(n: number | string | null | undefined) {
  if (n === null || n === undefined || n === '') return '';
  return String(n).replace('.', ',');
}
export function relativeDays(days: number | null | undefined) {
  if (days === null || days === undefined) return 'Nunca treinou';
  if (days === 0) return 'Treinou hoje';
  if (days === 1) return 'Treinou ontem';
  return `Há ${days} dias`;
}
export function timeAgo(d: string | Date) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} d`;
  return fmtDate(d);
}
export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
export function initials(name: string | null | undefined) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Extrai o código de convite de um QR/deep link (personalpro://convite/ABC, https://.../convite/ABC) ou texto puro. */
export function extractInviteCode(raw: string): string | null {
  const text = raw.trim();
  const m = text.match(/convite\/([A-Za-z0-9-]+)/i) || text.match(/[?&]code=([A-Za-z0-9-]+)/i);
  if (m) return m[1].toUpperCase();
  if (/^[A-Za-z0-9-]{4,16}$/.test(text)) return text.toUpperCase();
  return null;
}
