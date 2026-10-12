'use client';

import { formatDuration, toDateKey, type AssignedWorkout, type Paginated, type ProgressStats, type SessionHistoryItem } from '@personalpro/shared';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck2, ChevronLeft, ChevronRight, Clock, Dumbbell, Flame, History, Play, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BarsChart } from '@/components/charts';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, LinkButton, LoadingBlock, PageHeader, StatCard } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime, fmtDayKey, fmtNumber, MONTH_NAMES, WEEKDAYS_SHORT } from '@/lib/format';

export default function StudentWorkoutsPage() {
  const workouts = useQuery({ queryKey: ['my-workouts'], queryFn: () => api<AssignedWorkout[]>('/workouts/mine') });
  const stats = useQuery({ queryKey: ['progress-stats', 'me'], queryFn: () => api<ProgressStats>('/progress/stats', { query: { weeks: 12 } }) });
  const todayDow = new Date().getDay();

  return (
    <div>
      <PageHeader title="Meus treinos" subtitle="Fichas do seu personal, histórico e frequência" />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Treinos no mês" value={stats.data?.monthCount ?? '—'} icon={<CalendarCheck2 className="size-4" />} tone="accent" />
        <StatCard label="Frequência semanal" value={stats.data ? `${fmtNumber(stats.data.weeklyAverage)}x` : '—'} icon={<TrendingUp className="size-4" />} tone="info" hint={stats.data && `meta: ${stats.data.plannedPerWeek}x por semana`} />
        <StatCard label="Média mensal" value={stats.data ? fmtNumber(stats.data.monthlyAverage) : '—'} icon={<Flame className="size-4" />} tone="warning" hint={stats.data && `${stats.data.totalWorkouts} treinos no total`} />
        <StatCard label="Duração média" value={stats.data?.averageDurationSeconds ? formatDuration(stats.data.averageDurationSeconds) : '—'} icon={<Clock className="size-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          {workouts.isLoading ? (
            <LoadingBlock />
          ) : workouts.isError ? (
            <ErrorState error={workouts.error} onRetry={() => workouts.refetch()} />
          ) : workouts.data!.length === 0 ? (
            <Card>
              <EmptyState icon={<Dumbbell className="size-5" />} title="Nenhum treino atribuído" description="Quando seu personal montar sua ficha, ela aparece aqui." />
            </Card>
          ) : (
            workouts.data!.map((w) => {
              const today = w.weekdays.includes(todayDow);
              return (
                <Card key={w.assignmentId} className={cn('p-4 sm:p-5', today && 'border-accent/50')}>
                  <div className="flex items-start gap-4">
                    <span className={cn('grid size-14 shrink-0 place-items-center rounded-2xl text-2xl font-bold', today ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg')}>
                      {w.label ?? <Dumbbell className="size-6" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/aluno/treinos/${w.id}`} className="font-semibold hover:underline">
                          {w.name}
                        </Link>
                        {today && <Badge tone="accent">Hoje</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {w.exercises.length} exercícios · {w.exercises.reduce((a, e) => a + e.sets, 0)} séries
                      </p>
                      <div className="mt-2 grid max-w-xs grid-cols-7 gap-1">
                        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                          <span key={d} className={cn('grid h-6 place-items-center rounded-md text-[10px] font-medium', w.weekdays.includes(d) ? 'bg-accent-soft text-accent-ink' : 'bg-surface-2 text-subtle')}>
                            {WEEKDAYS_SHORT[d]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <LinkButton href={`/aluno/treinos/${w.id}`} variant="secondary">
                      Ver treino
                    </LinkButton>
                    <LinkButton href={`/aluno/treinos/${w.id}/executar`}>
                      <Play className="size-4 fill-current" /> Iniciar
                    </LinkButton>
                  </div>
                </Card>
              );
            })
          )}

          <Card>
            <CardHeader title="Frequência semanal" subtitle="treinos concluídos por semana" icon={<TrendingUp className="size-4" />} />
            <CardBody>
              <BarsChart data={stats.data?.weeklySeries ?? []} xKey="weekStart" series={[{ key: 'count', label: 'Treinos' }]} xFormatter={fmtDayKey} height={200} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <HistoryCalendar />
          <RecentSessions />
        </div>
      </div>
    </div>
  );
}

function HistoryCalendar() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const q = useQuery({
    queryKey: ['sessions', 'me', month.toISOString()],
    queryFn: () => api<Paginated<SessionHistoryItem>>('/sessions', { query: { from: month.toISOString(), to: next.toISOString(), pageSize: 100 } }),
  });
  const trained = useMemo(() => new Set((q.data?.items ?? []).filter((s) => s.finishedAt).map((s) => toDateKey(s.startedAt))), [q.data]);
  const offset = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const todayKey = toDateKey(new Date());

  return (
    <Card>
      <CardHeader
        title={`${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`}
        subtitle={`${trained.size} dia(s) treinados`}
        icon={<CalendarCheck2 className="size-4" />}
        action={
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Próximo mês" onClick={() => setMonth(next)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />
      <CardBody>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-subtle">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <span key={d}>{WEEKDAYS_SHORT[d]}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {Array.from({ length: offset }).map((_, i) => (
            <span key={`e${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const key = toDateKey(new Date(month.getFullYear(), month.getMonth(), i + 1));
            const done = trained.has(key);
            return (
              <span
                key={key}
                className={cn(
                  'tabular grid aspect-square place-items-center rounded-lg text-xs',
                  done ? 'bg-accent font-bold text-accent-fg' : 'bg-surface-2 text-muted',
                  key === todayKey && !done && 'ring-1 ring-accent',
                )}
                title={done ? 'Treino realizado' : undefined}
              >
                {i + 1}
              </span>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

function RecentSessions() {
  const q = useQuery({ queryKey: ['sessions', 'me', 'recent'], queryFn: () => api<Paginated<SessionHistoryItem>>('/sessions', { query: { pageSize: 8 } }) });
  return (
    <Card>
      <CardHeader title="Histórico" subtitle="Últimos treinos" icon={<History className="size-4" />} />
      <CardBody>
        {q.isLoading ? (
          <LoadingBlock />
        ) : !q.data?.items.length ? (
          <p className="py-4 text-center text-sm text-muted">Nenhum treino registrado ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {q.data.items.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.workout?.name ?? 'Treino'}</p>
                  <p className="text-xs text-muted">{fmtDateTime(s.startedAt)}</p>
                </div>
                <div className="tabular shrink-0 text-right text-xs text-muted">
                  <p className="font-semibold text-fg">{s.durationSeconds ? formatDuration(s.durationSeconds) : s.finishedAt ? '—' : 'em andamento'}</p>
                  <p>{fmtNumber(s.totalVolumeKg ?? 0, 0)} kg</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
