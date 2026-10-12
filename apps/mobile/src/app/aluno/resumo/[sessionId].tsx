import { formatDuration, type ExecutionView, type FinishSessionResponse } from '@personalpro/shared';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Button, Card, Divider, KeyValue, QueryState, Row, Screen, Section, StatCard, T } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtNumber, fmtTime, fmtDate } from '@/lib/format';
import { useTheme } from '@/theme';

type Summary = FinishSessionResponse['summary'];

/** Resumo pós-treino: início, fim, duração, exercícios, volume, calorias e recordes. */
export default function WorkoutSummary() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { colors } = useTheme();
  const q = useQuery({
    queryKey: ['session-summary', sessionId],
    queryFn: async (): Promise<FinishSessionResponse> => {
      // Sem cache (ex.: app reaberto): reconstrói o resumo a partir da sessão.
      const v = await api.get<ExecutionView>(`/sessions/${sessionId}`);
      const sets = v.exercises.flatMap((e) => e.today.map((s) => ({ ...s, exercise: e.name })));
      const summary: Summary = {
        startedAt: v.startedAt,
        finishedAt: v.finishedAt ?? v.startedAt,
        durationSeconds: v.durationSeconds ?? 0,
        totalVolumeKg: v.totalVolumeKg ?? 0,
        estimatedCalories: v.estimatedCalories,
        setsCount: sets.length,
        exercisesCount: v.exercises.filter((e) => e.today.length).length,
        personalRecords: sets.filter((s) => s.isPersonalRecord).map((s) => ({ exercise: s.exercise, loadKg: s.loadKg, reps: s.reps })),
        totalWorkouts: 0,
      };
      return { ...v, summary };
    },
    enabled: !!sessionId,
    staleTime: Infinity,
  });
  const s = q.data?.summary;

  return (
    <Screen
      footer={<Button title="VOLTAR AO INÍCIO" size="lg" onPress={() => router.replace('/aluno')} />}
    >
      <QueryState query={q}>
        {s ? (
          <>
            <View style={{ alignItems: 'center', marginTop: 24, gap: 8 }}>
              <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="check" size={44} color={colors.onAccent} strokeWidth={3} />
              </View>
              <T variant="h1" center style={{ marginTop: 8 }}>
                Treino concluído!
              </T>
              <T tone="secondary" center>
                {q.data?.workout?.name ?? 'Treino'}
                {s.totalWorkouts ? ` · ${s.totalWorkouts}º treino` : ''}
              </T>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24 }}>
              <StatCard label="Duração" value={formatDuration(s.durationSeconds)} icon="clock" />
              <StatCard label="Volume total" value={`${fmtNumber(s.totalVolumeKg, 0)} kg`} icon="bar-chart" />
              <StatCard label="Calorias estimadas" value={s.estimatedCalories ? `${s.estimatedCalories} kcal` : '—'} icon="flame" tone="warning" />
              <StatCard label="Exercícios" value={s.exercisesCount} hint={`${s.setsCount} séries`} icon="dumbbell" />
            </View>

            <Card style={{ marginTop: 16 }}>
              <KeyValue label="Data" value={fmtDate(s.startedAt)} />
              <Divider />
              <KeyValue label="Início" value={fmtTime(s.startedAt)} />
              <Divider />
              <KeyValue label="Fim" value={fmtTime(s.finishedAt)} />
              {q.data?.perceivedEffort ? (
                <>
                  <Divider />
                  <KeyValue label="Esforço percebido" value={`${q.data.perceivedEffort}/10`} />
                </>
              ) : null}
            </Card>

            <Section title={`Recordes pessoais (${s.personalRecords.length})`}>
              {s.personalRecords.length ? (
                <Card style={{ gap: 10, borderColor: colors.warning, borderWidth: 1 }}>
                  {s.personalRecords.map((r, i) => (
                    <Row key={i} gap={10}>
                      <T style={{ fontSize: 22 }}>🏆</T>
                      <T variant="bodyStrong" style={{ flex: 1 }}>
                        {r.exercise}
                      </T>
                      <T variant="h3" tone="warning">
                        {fmtNumber(r.loadKg)} kg × {r.reps}
                      </T>
                    </Row>
                  ))}
                </Card>
              ) : (
                <T tone="secondary">Nenhum recorde hoje — a consistência é o que gera resultado!</T>
              )}
            </Section>
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}
