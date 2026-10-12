'use client';

import {
  BODY_MEASUREMENT_KEYS,
  BODY_MEASUREMENT_LABELS,
  MUSCLE_GROUP_LABELS,
  formatDuration,
  type BodyMeasurementKey,
  type BodyProgress,
  type Evolution,
  type ExerciseProgress,
  type ExerciseProgressItem,
  type ProgressStats,
} from '@personalpro/shared';
import { useQuery } from '@tanstack/react-query';
import { Activity, CalendarDays, Dumbbell, Flame, Percent, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDayKey, fmtMonthKey, fmtNumber, fmtShort, fmtSigned } from '@/lib/format';
import { BarsChart, TrendChart } from './charts';
import { Card, CardBody, CardHeader, Chip, ErrorState, LoadingBlock, Segmented, Select } from './ui';

export function useProgress(studentId?: string) {
  const q = studentId ? { studentId } : undefined;
  const body = useQuery({ queryKey: ['progress-body', studentId ?? 'me'], queryFn: () => api<BodyProgress>('/progress/body', { query: q }) });
  const stats = useQuery({ queryKey: ['progress-stats', studentId ?? 'me'], queryFn: () => api<ProgressStats>('/progress/stats', { query: { ...q, weeks: 12 } }) });
  const exercises = useQuery({
    queryKey: ['progress-exercises', studentId ?? 'me'],
    queryFn: () => api<ExerciseProgressItem[]>('/progress/exercises', { query: q }),
  });
  return { body, stats, exercises };
}

/** Variação com cor semântica: para peso/gordura, cair é bom quando lowerIsBetter. */
export function DeltaPill({ evo, unit, lowerIsBetter }: { evo: Evolution | null | undefined; unit: string; lowerIsBetter?: boolean }) {
  if (!evo || evo.delta === 0) return <span className="text-xs text-muted">sem variação</span>;
  const good = lowerIsBetter ? evo.delta < 0 : evo.delta > 0;
  const Icon = evo.delta < 0 ? TrendingDown : TrendingUp;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', good ? 'text-success' : 'text-warning')}>
      <Icon className="size-3.5" />
      {fmtSigned(evo.delta, unit)}
      {evo.deltaPct !== null && <span className="font-normal text-muted">({fmtSigned(evo.deltaPct, '%')})</span>}
    </span>
  );
}

function MiniStat({ icon, label, value, delta }: { icon: React.ReactNode; label: string; value: string; delta?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="text-subtle [&>svg]:size-4">{icon}</span>
        {label}
      </div>
      <p className="tabular mt-1.5 text-xl font-semibold tracking-tight">{value}</p>
      {delta && <div className="mt-0.5">{delta}</div>}
    </Card>
  );
}

export function EvolutionPanel({ studentId, compact }: { studentId?: string; compact?: boolean }) {
  const { body, stats, exercises } = useProgress(studentId);
  const [measureKeys, setMeasureKeys] = useState<BodyMeasurementKey[]>(['waist', 'abdomen', 'rightArm']);
  const [freqMode, setFreqMode] = useState<'week' | 'month'>('week');

  const series = useMemo(
    () =>
      (body.data?.series ?? []).map((s): Record<string, string | number | null> => ({
        date: s.date.slice(0, 10),
        weightKg: s.weightKg,
        bodyFatPct: s.bodyFatPct,
        muscleMassKg: s.muscleMassKg,
        ...Object.fromEntries(BODY_MEASUREMENT_KEYS.map((k) => [k, s.measurements?.[k] ?? null])),
      })),
    [body.data],
  );
  const availableMeasures = BODY_MEASUREMENT_KEYS.filter((k) => series.some((s) => s[k] !== null));

  if (body.isLoading || stats.isLoading) return <LoadingBlock />;
  if (body.isError) return <ErrorState error={body.error} onRetry={() => body.refetch()} />;

  const b = body.data!;
  const st = stats.data;
  const last = series[series.length - 1];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat icon={<Scale />} label="Peso" value={b.weight ? `${fmtNumber(b.weight.current)} kg` : last?.weightKg ? `${fmtNumber(last.weightKg as number)} kg` : '—'} delta={<DeltaPill evo={b.weight} unit="kg" lowerIsBetter />} />
        <MiniStat icon={<Percent />} label="% de gordura" value={b.bodyFat ? `${fmtNumber(b.bodyFat.current)}%` : '—'} delta={<DeltaPill evo={b.bodyFat} unit="p.p." lowerIsBetter />} />
        <MiniStat icon={<Activity />} label="Massa muscular" value={b.muscleMass ? `${fmtNumber(b.muscleMass.current)} kg` : '—'} delta={<DeltaPill evo={b.muscleMass} unit="kg" />} />
        <MiniStat
          icon={<CalendarDays />}
          label="Frequência"
          value={st ? `${fmtNumber(st.weeklyAverage)}x/sem` : '—'}
          delta={st && <span className="text-xs text-muted">meta {st.plannedPerWeek}x · {st.totalWorkouts} treinos</span>}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Peso corporal" subtitle="kg por avaliação" icon={<Scale className="size-4" />} />
          <CardBody>
            <TrendChart area data={series} xKey="date" series={[{ key: 'weightKg', label: 'Peso' }]} unit="kg" xFormatter={fmtShortKey} empty="Registre avaliações para ver o gráfico de peso" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="% de gordura" subtitle="percentual por avaliação" icon={<Percent className="size-4" />} />
          <CardBody>
            <TrendChart data={series} xKey="date" series={[{ key: 'bodyFatPct', label: '% gordura', color: 'var(--chart-3)' }]} unit="%" xFormatter={fmtShortKey} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Massa muscular" subtitle="kg por avaliação" icon={<Activity className="size-4" />} />
          <CardBody>
            <TrendChart data={series} xKey="date" series={[{ key: 'muscleMassKg', label: 'Massa muscular', color: 'var(--chart-2)' }]} unit="kg" xFormatter={fmtShortKey} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Frequência de treinos"
            subtitle={freqMode === 'week' ? 'treinos por semana (12 semanas)' : 'treinos por mês'}
            icon={<CalendarDays className="size-4" />}
            action={
              <Segmented
                value={freqMode}
                onChange={setFreqMode}
                options={[
                  { value: 'week', label: 'Semana' },
                  { value: 'month', label: 'Mês' },
                ]}
              />
            }
          />
          <CardBody>
            {freqMode === 'week' ? (
              <BarsChart data={st?.weeklySeries ?? []} xKey="weekStart" series={[{ key: 'count', label: 'Treinos' }]} xFormatter={fmtDayKey} empty="Nenhum treino concluído no período" />
            ) : (
              <BarsChart data={st?.monthlySeries ?? []} xKey="month" series={[{ key: 'count', label: 'Treinos' }]} xFormatter={fmtMonthKey} empty="Nenhum treino concluído no período" />
            )}
            {st && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-surface-2 p-2">
                  <p className="text-muted">Este mês</p>
                  <p className="tabular text-base font-semibold">{st.monthCount}</p>
                </div>
                <div className="rounded-xl bg-surface-2 p-2">
                  <p className="text-muted">Duração média</p>
                  <p className="tabular text-base font-semibold">{st.averageDurationSeconds ? formatDuration(st.averageDurationSeconds) : '—'}</p>
                </div>
                <div className="rounded-xl bg-surface-2 p-2">
                  <p className="text-muted">Sequência</p>
                  <p className="tabular text-base font-semibold">
                    {st.currentStreakDays} <Flame className="inline size-3.5 text-warning" />
                  </p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {!compact && (
        <Card>
          <CardHeader title="Medidas corporais" subtitle="cm — selecione até 4 medidas" icon={<Activity className="size-4" />} />
          <CardBody>
            {availableMeasures.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Nenhuma medida registrada nas avaliações.</p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {availableMeasures.map((k) => (
                    <Chip
                      key={k}
                      active={measureKeys.includes(k)}
                      onClick={() =>
                        setMeasureKeys((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : prev.length >= 4 ? [...prev.slice(1), k] : [...prev, k]))
                      }
                    >
                      {BODY_MEASUREMENT_LABELS[k]}
                    </Chip>
                  ))}
                </div>
                <TrendChart
                  data={series}
                  xKey="date"
                  series={availableMeasures
                    .filter((k) => measureKeys.includes(k))
                    .map((k) => ({ key: k, label: BODY_MEASUREMENT_LABELS[k], color: `var(--chart-${BODY_MEASUREMENT_KEYS.indexOf(k) % 5 + 1})` }))}
                  unit="cm"
                  xFormatter={fmtShortKey}
                  height={240}
                />
              </>
            )}
          </CardBody>
        </Card>
      )}

      <ExerciseLoadCard studentId={studentId} items={exercises.data ?? []} loading={exercises.isLoading} />
    </div>
  );
}

const fmtShortKey = (k: string) => fmtShort(`${k}T12:00:00`);

export function ExerciseLoadCard({ studentId, items, loading }: { studentId?: string; items: ExerciseProgressItem[]; loading?: boolean }) {
  const [selected, setSelected] = useState<string>('');
  const exerciseId = selected || items[0]?.exerciseId || '';
  const detail = useQuery({
    enabled: !!exerciseId,
    queryKey: ['progress-exercise', studentId ?? 'me', exerciseId],
    queryFn: () => api<ExerciseProgress>(`/progress/exercises/${exerciseId}`, { query: studentId ? { studentId } : undefined }),
  });

  return (
    <Card>
      <CardHeader title="Progressão de carga" subtitle="melhor série por sessão (kg)" icon={<Dumbbell className="size-4" />} />
      <CardBody>
        {loading ? (
          <LoadingBlock />
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Os gráficos de carga aparecem após os primeiros treinos registrados.</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <div className="space-y-3">
              <Select
                value={exerciseId}
                onChange={(e) => setSelected(e.target.value)}
                options={items.map((i) => ({ value: i.exerciseId, label: i.name }))}
                className="lg:hidden"
              />
              <ul className="hidden max-h-72 space-y-1 overflow-y-auto pr-1 lg:block">
                {items.map((i) => (
                  <li key={i.exerciseId}>
                    <button
                      type="button"
                      onClick={() => setSelected(i.exerciseId)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition',
                        exerciseId === i.exerciseId ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2/60',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{i.name}</span>
                        <span className="block text-xs text-subtle">{MUSCLE_GROUP_LABELS[i.muscleGroup]} · {i.sessions} sessões</span>
                      </span>
                      <span className={cn('tabular shrink-0 text-xs font-semibold', i.deltaKg > 0 ? 'text-success' : 'text-muted')}>{fmtSigned(i.deltaKg, 'kg')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              {detail.data && (
                <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <p className="text-sm font-semibold">{detail.data.exercise.name}</p>
                  {detail.data.evolution && (
                    <p className="text-xs text-muted">
                      {fmtNumber(detail.data.evolution.initial)} → <span className="font-semibold text-fg">{fmtNumber(detail.data.evolution.current)} kg</span>{' '}
                      <DeltaPill evo={detail.data.evolution} unit="kg" />
                    </p>
                  )}
                </div>
              )}
              {detail.isLoading ? (
                <LoadingBlock />
              ) : (
                <TrendChart
                  data={(detail.data?.points ?? []) as unknown as Record<string, number>[]}
                  xKey="date"
                  series={[
                    { key: 'loadKg', label: 'Carga', color: 'var(--chart-1)' },
                    { key: 'estimatedOneRepMaxKg', label: '1RM estimado', color: 'var(--chart-2)' },
                  ]}
                  unit="kg"
                  xFormatter={fmtShortKey}
                  height={240}
                />
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
