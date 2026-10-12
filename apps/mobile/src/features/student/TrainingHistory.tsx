import { formatDuration, toDateKey, type Paginated, type ProgressStats, type SessionHistoryItem } from '@personalpro/shared';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { CalendarMonth } from '@/components/CalendarMonth';
import { BarChart } from '@/components/Charts';
import { Card, Chips, Divider, EmptyState, ListItem, QueryState, Row, Section, StatCard, T } from '@/components/ui';
import { useApi } from '@/features/hooks';
import { fmtDateTime, fmtDayMonth, fmtNumber, MONTHS_SHORT } from '@/lib/format';

/** Histórico de treinos: calendário mensal, frequência, duração média e gráfico. Reutilizado pelo professor (studentId). */
export function TrainingHistory({ studentId }: { studentId?: string }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [range, setRange] = useState<'week' | 'month'>('week');
  const from = new Date(month.getFullYear(), month.getMonth(), 1);
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
  const stats = useApi<ProgressStats>(['progress', 'stats', studentId ?? 'me'], '/progress/stats', { studentId, weeks: 12 });
  const sessions = useApi<Paginated<SessionHistoryItem>>(
    ['sessions', studentId ?? 'me', toDateKey(from)],
    '/sessions',
    { studentId, from: from.toISOString(), to: to.toISOString(), pageSize: 100 },
  );

  const trained = useMemo(() => {
    const set = new Set(stats.data?.trainedDays ?? []);
    sessions.data?.items.forEach((s) => set.add(toDateKey(s.startedAt)));
    return set;
  }, [stats.data, sessions.data]);

  const s = stats.data;
  const series =
    range === 'week'
      ? (s?.weeklySeries ?? []).map((w) => ({ label: fmtDayMonth(`${w.weekStart}T12:00:00`), value: w.count }))
      : (s?.monthlySeries ?? []).slice(-6).map((m) => ({ label: MONTHS_SHORT[Number(m.month.slice(5, 7)) - 1], value: m.count }));

  return (
    <View>
      <Card>
        <CalendarMonth month={month} onChangeMonth={setMonth} marked={trained} />
        <Divider style={{ marginVertical: 12 }} />
        <Row justify="space-between">
          <T tone="secondary">Treinos neste mês</T>
          <T variant="h3" tone="accent">
            {sessions.data?.total ?? '—'}
          </T>
        </Row>
      </Card>

      <QueryState query={stats}>
        {s ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
              <StatCard label="Frequência semanal" value={fmtNumber(s.weeklyAverage)} hint={`meta ${s.plannedPerWeek}x/semana`} icon="activity" />
              <StatCard label="Frequência mensal" value={fmtNumber(s.monthlyAverage)} hint="média 3 meses" icon="calendar" />
              <StatCard label="Duração média" value={s.averageDurationSeconds ? formatDuration(s.averageDurationSeconds) : '—'} icon="clock" />
              <StatCard label="Sequência" value={`${s.currentStreakDays} dias`} hint={`${s.totalWorkouts} treinos no total`} icon="flame" />
            </View>
            <Section title="Frequência">
              <Card>
                <Chips
                  options={[
                    { value: 'week', label: 'Por semana' },
                    { value: 'month', label: 'Por mês' },
                  ]}
                  value={range}
                  onChange={(v) => v && setRange(v)}
                />
                <BarChart data={series} target={range === 'week' ? s.plannedPerWeek : undefined} />
              </Card>
            </Section>
          </>
        ) : null}
      </QueryState>

      <Section title="Treinos do mês">
        <QueryState query={sessions}>
          {sessions.data?.items.length ? (
            <Card padding={12}>
              {sessions.data.items.map((it, i) => (
                <View key={it.id}>
                  {i > 0 ? <Divider /> : null}
                  <ListItem
                    icon="check-circle"
                    title={it.workout?.name ?? 'Treino livre'}
                    subtitle={[
                      fmtDateTime(it.startedAt),
                      it.durationSeconds ? formatDuration(it.durationSeconds) : null,
                      it.totalVolumeKg ? `${fmtNumber(it.totalVolumeKg, 0)} kg` : null,
                      it.estimatedCalories ? `${it.estimatedCalories} kcal` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                </View>
              ))}
            </Card>
          ) : (
            <EmptyState icon="calendar" title="Nenhum treino neste mês" />
          )}
        </QueryState>
      </Section>
    </View>
  );
}
