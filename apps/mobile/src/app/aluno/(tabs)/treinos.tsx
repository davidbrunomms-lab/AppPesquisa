import type { AssignedWorkout } from '@personalpro/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, EmptyState, QueryState, Row, Screen, Segmented, T, Badge } from '@/components/ui';
import { useApi, useRefresh } from '@/features/hooks';
import { TrainingHistory } from '@/features/student/TrainingHistory';
import { WorkoutExercises, weekdaysLabel } from '@/features/workouts/WorkoutExercises';
import { useTheme } from '@/theme';

export default function StudentWorkouts() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<'fichas' | 'historico'>('fichas');
  const q = useApi<AssignedWorkout[]>(['workouts', 'mine'], '/workouts/mine');
  const { refreshing, onRefresh } = useRefresh(q.refetch);

  return (
    <Screen title="Treinos" refreshing={refreshing} onRefresh={onRefresh} edgeBottom={false}>
      <Segmented
        options={[
          { value: 'fichas', label: 'Minhas fichas' },
          { value: 'historico', label: 'Histórico' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'historico' ? (
        <TrainingHistory />
      ) : (
        <QueryState query={q}>
          {q.data?.length ? (
            <View style={{ gap: 16 }}>
              {q.data.map((w) => (
                <Card key={w.assignmentId}>
                  <Row gap={12} style={{ marginBottom: 12 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                      <T variant="h2" tone="onAccent">
                        {w.label || w.name.slice(0, 1)}
                      </T>
                    </View>
                    <View style={{ flex: 1 }}>
                      <T variant="h3" numberOfLines={2}>
                        {w.name}
                      </T>
                      <Row gap={6} style={{ marginTop: 4 }}>
                        <Badge label={weekdaysLabel(w.weekdays)} icon="calendar" />
                        <Badge label={`${w.exercises.length} exercícios`} />
                      </Row>
                    </View>
                  </Row>
                  {w.description ? (
                    <T tone="secondary" style={{ marginBottom: 8 }}>
                      {w.description}
                    </T>
                  ) : null}
                  <WorkoutExercises exercises={w.exercises} />
                  <Button title="INICIAR TREINO" icon="play" style={{ marginTop: 14 }} onPress={() => router.push(`/aluno/executar/${w.id}`)} />
                </Card>
              ))}
            </View>
          ) : (
            <EmptyState icon="dumbbell" title="Nenhum treino atribuído" message="Quando seu professor montar sua ficha, ela aparecerá aqui." />
          )}
        </QueryState>
      )}
    </Screen>
  );
}
