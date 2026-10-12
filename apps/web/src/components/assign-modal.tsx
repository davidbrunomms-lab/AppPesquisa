'use client';

import type { StudentListItem, Workout } from '@personalpro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { WEEKDAYS_SHORT } from '@/lib/format';
import { useToast } from './toast';
import { Button, Chip, Field, Modal, Select } from './ui';

export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  // Segunda a domingo
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="flex flex-wrap gap-1.5">
      {order.map((d) => (
        <Chip key={d} active={value.includes(d)} onClick={() => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort())} className="w-12 justify-center">
          {WEEKDAYS_SHORT[d]}
        </Chip>
      ))}
    </div>
  );
}

/**
 * Atribui um treino a um aluno com dias da semana. Informe `workout` (escolhe
 * o aluno) ou `studentId` (escolhe o treino).
 */
export function AssignModal({
  workout,
  studentId,
  initialWeekdays = [],
  onClose,
}: {
  workout?: Workout;
  studentId?: string;
  initialWeekdays?: number[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [student, setStudent] = useState(studentId ?? '');
  const [workoutId, setWorkoutId] = useState(workout?.id ?? '');
  const [weekdays, setWeekdays] = useState<number[]>(initialWeekdays);
  const students = useQuery({ enabled: !studentId, queryKey: ['students', { status: 'ACTIVE' }], queryFn: () => api<StudentListItem[]>('/students', { query: { status: 'ACTIVE' } }) });
  const workouts = useQuery({ enabled: !workout, queryKey: ['workouts'], queryFn: () => api<Workout[]>('/workouts') });

  const assign = useMutation({
    mutationFn: () => api(`/workouts/${workoutId}/assign`, { method: 'POST', body: { studentId: student, weekdays } }),
    onSuccess: () => {
      toast.success('Treino atribuído', 'O aluno foi notificado.');
      qc.invalidateQueries({ queryKey: ['student-workouts'] });
      qc.invalidateQueries({ queryKey: ['workouts'] });
      onClose();
    },
    onError: (e) => toast.error('Não foi possível atribuir', errorMessage(e)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={workout ? `Atribuir "${workout.name}"` : 'Atribuir treino'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={assign.isPending} disabled={!student || !workoutId} onClick={() => assign.mutate()}>
            Atribuir
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!studentId && (
          <Select
            label="Aluno"
            value={student}
            onChange={(e) => setStudent(e.target.value)}
            placeholder="Selecione o aluno…"
            options={(students.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
          />
        )}
        {!workout && (
          <Select
            label="Treino"
            value={workoutId}
            onChange={(e) => setWorkoutId(e.target.value)}
            placeholder="Selecione o treino…"
            options={(workouts.data ?? []).map((w) => ({ value: w.id, label: `${w.label ? `${w.label} · ` : ''}${w.name}` }))}
          />
        )}
        <Field label="Dias da semana" hint="O treino aparece como “treino do dia” do aluno nesses dias.">
          <WeekdayPicker value={weekdays} onChange={setWeekdays} />
        </Field>
      </div>
    </Modal>
  );
}
