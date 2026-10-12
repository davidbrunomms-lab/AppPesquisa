import type { Workout } from '@personalpro/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Avatar, Badge, Button, Card, EmptyState, IconButton, QueryState, Row, Screen, Segmented, T } from '@/components/ui';
import { useApi, useInvalidate, useRefresh } from '@/features/hooks';
import { AssignSheet } from '@/features/trainer/StudentWorkoutsTab';
import { ExerciseLibrary } from '@/features/trainer/ExerciseLibrary';
import { confirm, notifyError } from '@/lib/alert';
import { api } from '@/lib/api';
import { useTheme } from '@/theme';

export default function TrainerWorkouts() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<'fichas' | 'biblioteca'>('fichas');
  const q = useApi<Workout[]>(['workouts', 'list'], '/workouts');
  const invalidate = useInvalidate();
  const { refreshing, onRefresh } = useRefresh(q.refetch);
  const [assignFor, setAssignFor] = useState<string | null>(null);

  const duplicate = async (w: Workout) => {
    try {
      await api.post(`/workouts/${w.id}/duplicate`);
      await invalidate(['workouts']);
    } catch (e) {
      notifyError(e);
    }
  };
  const remove = async (w: Workout) => {
    if (!(await confirm('Excluir treino', `Excluir "${w.name}"? Os alunos deixarão de vê-lo.`, { confirmText: 'Excluir', destructive: true }))) return;
    try {
      await api.delete(`/workouts/${w.id}`);
      await invalidate(['workouts']);
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <Screen
      title="Treinos"
      refreshing={refreshing}
      onRefresh={onRefresh}
      edgeBottom={false}
      right={
        tab === 'fichas' ? (
          <IconButton icon="plus" label="Novo treino" tone="accent" onPress={() => router.push('/professor/treino/editor')} />
        ) : (
          <IconButton icon="plus" label="Novo exercício" tone="accent" onPress={() => router.push('/professor/exercicio-form')} />
        )
      }
    >
      <Segmented
        options={[
          { value: 'fichas', label: 'Fichas de treino' },
          { value: 'biblioteca', label: 'Biblioteca de exercícios' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'biblioteca' ? (
        <ExerciseLibrary />
      ) : (
        <QueryState query={q}>
          {q.data?.length ? (
            <View style={{ gap: 12 }}>
              {q.data.map((w) => {
                const assigned = (w.studentWorkouts ?? []).filter((sw) => sw.active);
                return (
                  <Card key={w.id} onPress={() => router.push({ pathname: '/professor/treino/editor', params: { id: w.id } })}>
                    <Row gap={12}>
                      <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                        <T variant="h2" tone="accent">
                          {w.label || w.name.slice(0, 1)}
                        </T>
                      </View>
                      <View style={{ flex: 1 }}>
                        <T variant="bodyStrong" numberOfLines={2}>
                          {w.name}
                        </T>
                        <Row gap={6} style={{ marginTop: 4 }}>
                          <Badge label={`${w.exercises.length} exercícios`} />
                          {w.isTemplate ? <Badge label="Modelo" tone="info" /> : null}
                        </Row>
                      </View>
                    </Row>
                    {assigned.length ? (
                      <Row gap={6} style={{ marginTop: 12 }}>
                        {assigned.slice(0, 5).map((sw) => (
                          <Avatar key={sw.studentId} name={sw.student.user.name} url={sw.student.user.avatarUrl} size={26} />
                        ))}
                        <T variant="small" tone="muted">
                          {assigned.length} aluno(s)
                        </T>
                      </Row>
                    ) : (
                      <T variant="small" tone="muted" style={{ marginTop: 10 }}>
                        Não atribuído
                      </T>
                    )}
                    <Row gap={8} wrap style={{ marginTop: 12 }}>
                      <Button title="Atribuir" icon="user-plus" size="sm" full={false} onPress={() => setAssignFor(w.id)} />
                      <Button title="Duplicar" icon="copy" size="sm" variant="secondary" full={false} onPress={() => duplicate(w)} />
                      <Button title="Excluir" icon="trash" size="sm" variant="danger" full={false} onPress={() => remove(w)} />
                    </Row>
                  </Card>
                );
              })}
            </View>
          ) : (
            <EmptyState icon="dumbbell" title="Nenhuma ficha criada" message="Monte treinos A/B/C com exercícios da biblioteca." action="Criar treino" onAction={() => router.push('/professor/treino/editor')} />
          )}
        </QueryState>
      )}
      {assignFor ? <AssignSheet visible onClose={() => setAssignFor(null)} workoutId={assignFor} /> : null}
    </Screen>
  );
}
