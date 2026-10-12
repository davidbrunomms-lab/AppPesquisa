import type { AssignedWorkout, Workout } from '@personalpro/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { Badge, Button, Card, Chips, EmptyState, MultiChips, QueryState, Row, Section, T } from '@/components/ui';
import { useApi, useInvalidate } from '@/features/hooks';
import { TrainingHistory } from '@/features/student/TrainingHistory';
import { WorkoutExercises, weekdaysLabel } from '@/features/workouts/WorkoutExercises';
import { confirm, notify, notifyError } from '@/lib/alert';
import { api } from '@/lib/api';
import { WEEKDAYS_SHORT } from '@/lib/format';

export const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: d, label: WEEKDAYS_SHORT[d] }));

/** Treinos atribuídos ao aluno (atribuir/desatribuir) + histórico. */
export function StudentWorkoutsTab({ studentId }: { studentId: string }) {
  const invalidate = useInvalidate();
  const q = useApi<AssignedWorkout[]>(['workouts', 'student', studentId], `/students/${studentId}/workouts`);
  const [assignOpen, setAssignOpen] = useState(false);

  const unassign = async (w: AssignedWorkout) => {
    if (!(await confirm('Remover treino', `Remover "${w.name}" deste aluno?`, { confirmText: 'Remover', destructive: true }))) return;
    try {
      await api.delete(`/workouts/${w.id}/assign/${studentId}`);
      await invalidate(['workouts']);
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <View>
      <Row gap={10}>
        <View style={{ flex: 1 }}>
          <Button title="Atribuir treino" icon="plus" size="sm" onPress={() => setAssignOpen(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Criar novo treino"
            icon="edit"
            size="sm"
            variant="secondary"
            onPress={() => router.push({ pathname: '/professor/treino/editor', params: { studentId } })}
          />
        </View>
      </Row>
      <View style={{ height: 14 }} />
      <QueryState query={q}>
        {q.data?.length ? (
          <View style={{ gap: 12 }}>
            {q.data.map((w) => (
              <Card key={w.assignmentId}>
                <Row justify="space-between" style={{ marginBottom: 6 }}>
                  <Row gap={8} style={{ flex: 1 }}>
                    {w.label ? <Badge label={w.label} tone="accent" /> : null}
                    <T variant="h3" style={{ flex: 1 }} numberOfLines={1}>
                      {w.name}
                    </T>
                  </Row>
                </Row>
                <Badge label={weekdaysLabel(w.weekdays)} icon="calendar" />
                <View style={{ height: 8 }} />
                <WorkoutExercises exercises={w.exercises} />
                <Row gap={8} style={{ marginTop: 12 }}>
                  <Button title="Editar" icon="edit" size="sm" variant="secondary" full={false} onPress={() => router.push({ pathname: '/professor/treino/editor', params: { id: w.id } })} />
                  <Button title="Remover" icon="x" size="sm" variant="danger" full={false} onPress={() => unassign(w)} />
                </Row>
              </Card>
            ))}
          </View>
        ) : (
          <EmptyState icon="dumbbell" title="Nenhum treino atribuído" message="Atribua uma ficha existente ou crie uma nova." />
        )}
      </QueryState>
      <Section title="Histórico de treinos">
        <TrainingHistory studentId={studentId} />
      </Section>
      <AssignSheet visible={assignOpen} onClose={() => setAssignOpen(false)} studentId={studentId} />
    </View>
  );
}

export function AssignSheet({
  visible,
  onClose,
  studentId,
  workoutId,
}: {
  visible: boolean;
  onClose: () => void;
  studentId?: string;
  workoutId?: string;
}) {
  const invalidate = useInvalidate();
  const workouts = useApi<Workout[]>(['workouts', 'list'], visible && !workoutId ? '/workouts' : null);
  const students = useApi<{ id: string; name: string }[]>(['students', 'list', 'assign'], visible && !studentId ? '/students' : null, { status: 'ACTIVE' });
  const [selectedWorkout, setSelectedWorkout] = useState<string | null>(workoutId ?? null);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(studentId ?? null);
  const [days, setDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const wid = workoutId ?? selectedWorkout;
    const sid = studentId ?? selectedStudent;
    if (!wid || !sid) return notify('Selecione o treino e o aluno');
    setLoading(true);
    try {
      await api.post(`/workouts/${wid}/assign`, { studentId: sid, weekdays: days });
      await invalidate(['workouts'], ['dashboard']);
      notify('Treino atribuído', 'O aluno foi notificado.');
      setDays([]);
      onClose();
    } catch (e) {
      notifyError(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Atribuir treino">
      {!workoutId ? (
        <QueryState query={workouts}>
          <Chips label="Treino" options={(workouts.data ?? []).map((w) => ({ value: w.id, label: w.label ? `${w.label} · ${w.name}` : w.name }))} value={selectedWorkout} onChange={setSelectedWorkout} />
        </QueryState>
      ) : null}
      {!studentId ? (
        <QueryState query={students}>
          <Chips label="Aluno" options={(students.data ?? []).map((s) => ({ value: s.id, label: s.name }))} value={selectedStudent} onChange={setSelectedStudent} />
        </QueryState>
      ) : null}
      <MultiChips label="Dias da semana (opcional)" options={WEEKDAY_OPTIONS} values={days} onChange={setDays} />
      <Button title="Atribuir" icon="check" onPress={submit} loading={loading} />
    </Sheet>
  );
}
