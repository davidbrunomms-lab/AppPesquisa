'use client';

import { APPOINTMENT_STATUS_LABELS, type Appointment } from '@personalpro/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { addDaysLocal, fmtTime, sameDay, WEEKDAYS_SHORT } from '@/lib/format';
import { Badge, Button } from './ui';

const START_HOUR = 6;
const END_HOUR = 22;
const HOUR_PX = 52;

const toneClass: Record<Appointment['status'], string> = {
  AVAILABLE: 'border-info/40 bg-info-soft text-info border-dashed',
  REQUESTED: 'border-warning/50 bg-warning-soft text-warning',
  CONFIRMED: 'border-accent/60 bg-accent-soft text-accent-ink',
  CANCELED: 'border-danger/30 bg-danger-soft text-danger line-through opacity-70',
  COMPLETED: 'border-success/40 bg-success-soft text-success',
};

export function WeekNav({ weekStart, onChange }: { weekStart: Date; onChange: (d: Date) => void }) {
  const end = addDaysLocal(weekStart, 6);
  const label = `${weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`.replace(/\./g, '');
  return (
    <div className="flex items-center gap-1">
      <Button size="icon" variant="secondary" aria-label="Semana anterior" onClick={() => onChange(addDaysLocal(weekStart, -7))}>
        <ChevronLeft className="size-4" />
      </Button>
      <Button size="sm" variant="ghost" className="h-9" onClick={() => onChange(startOfThisWeek())}>
        Hoje
      </Button>
      <Button size="icon" variant="secondary" aria-label="Próxima semana" onClick={() => onChange(addDaysLocal(weekStart, 7))}>
        <ChevronRight className="size-4" />
      </Button>
      <span className="ml-2 text-sm font-medium">{label}</span>
    </div>
  );
}

export function startOfThisWeek() {
  const d = new Date();
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function WeekCalendar({
  weekStart,
  appointments,
  onSelect,
  onEmptyClick,
  showStudent = true,
}: {
  weekStart: Date;
  appointments: Appointment[];
  onSelect: (a: Appointment) => void;
  onEmptyClick?: (date: Date) => void;
  showStudent?: boolean;
}) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysLocal(weekStart, i)), [weekStart]);
  const today = new Date();
  const [mobileDay, setMobileDay] = useState(() => {
    const idx = days.findIndex((d) => sameDay(d, today));
    return idx >= 0 ? idx : 0;
  });
  const byDay = (d: Date) => appointments.filter((a) => sameDay(new Date(a.startsAt), d)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <>
      {/* Mobile: faixa de dias + lista */}
      <div className="md:hidden">
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            const count = byDay(d).filter((a) => a.status !== 'CANCELED').length;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setMobileDay(i)}
                className={cn('flex flex-col items-center rounded-xl py-2 text-xs transition', mobileDay === i ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted')}
              >
                <span>{WEEKDAYS_SHORT[d.getDay()]}</span>
                <span className={cn('tabular text-base font-semibold', mobileDay !== i && sameDay(d, today) && 'text-accent-ink')}>{d.getDate()}</span>
                <span className={cn('mt-0.5 size-1 rounded-full', count ? (mobileDay === i ? 'bg-accent-fg' : 'bg-accent') : 'bg-transparent')} />
              </button>
            );
          })}
        </div>
        <ul className="mt-4 space-y-2">
          {byDay(days[mobileDay]).length === 0 && (
            <li className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted">
              Nada agendado.
              {onEmptyClick && (
                <button className="ml-1 font-medium text-accent-ink" onClick={() => onEmptyClick(days[mobileDay])}>
                  Adicionar
                </button>
              )}
            </li>
          )}
          {byDay(days[mobileDay]).map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => onSelect(a)} className={cn('flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left', toneClass[a.status])}>
                <span className="tabular w-12 shrink-0 text-sm font-semibold">{fmtTime(a.startsAt)}</span>
                <span className="min-w-0 flex-1 text-sm text-fg">
                  <span className="block truncate font-medium">{showStudent ? a.student?.name ?? 'Horário livre' : a.trainer.name}</span>
                  <span className="block text-xs text-muted">
                    até {fmtTime(a.endsAt)}
                    {a.location ? ` · ${a.location}` : ''}
                  </span>
                </span>
                <Badge className="bg-transparent px-0">{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Desktop: grade semanal */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-surface md:block">
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border">
          <div />
          {days.map((d, i) => (
            <div key={i} className={cn('border-l border-border px-2 py-2.5 text-center', sameDay(d, today) && 'bg-accent-soft')}>
              <p className="text-[11px] font-medium text-muted uppercase">{WEEKDAYS_SHORT[d.getDay()]}</p>
              <p className={cn('tabular text-lg font-semibold', sameDay(d, today) && 'text-accent-ink')}>{d.getDate()}</p>
            </div>
          ))}
        </div>
        <div className="max-h-[640px] overflow-y-auto">
          <div className="relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))]" style={{ height: hours.length * HOUR_PX }}>
            <div>
              {hours.map((h) => (
                <div key={h} className="tabular -translate-y-2 pr-2 text-right text-[11px] text-subtle" style={{ height: HOUR_PX }}>
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {days.map((d, i) => (
              <div key={i} className="relative border-l border-border">
                {hours.map((h) => (
                  <div
                    key={h}
                    className={cn('border-t border-border/60', onEmptyClick && 'cursor-pointer hover:bg-surface-2/50')}
                    style={{ height: HOUR_PX }}
                    onClick={() => {
                      if (!onEmptyClick) return;
                      const x = new Date(d);
                      x.setHours(h, 0, 0, 0);
                      onEmptyClick(x);
                    }}
                  />
                ))}
                {byDay(d).map((a) => {
                  const s = new Date(a.startsAt);
                  const e = new Date(a.endsAt);
                  const top = (s.getHours() + s.getMinutes() / 60 - START_HOUR) * HOUR_PX;
                  const height = Math.max(22, ((e.getTime() - s.getTime()) / 3_600_000) * HOUR_PX - 3);
                  if (top < 0 || top > hours.length * HOUR_PX) return null;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onSelect(a)}
                      className={cn('absolute inset-x-1 overflow-hidden rounded-lg border px-1.5 py-1 text-left text-[11px] leading-tight transition hover:brightness-110', toneClass[a.status])}
                      style={{ top: top + 1, height }}
                      title={`${fmtTime(a.startsAt)}–${fmtTime(a.endsAt)} · ${APPOINTMENT_STATUS_LABELS[a.status]}`}
                    >
                      <span className="tabular block font-semibold">{fmtTime(a.startsAt)}</span>
                      <span className="block truncate text-fg/90">{showStudent ? a.student?.name ?? 'Livre' : a.trainer.name}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
