'use client';

import { formatDuration, type AssignedWorkout, type Paginated, type SessionHistoryItem } from '@personalpro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Dumbbell, History, Pencil, Plus, Unlink } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AssignModal } from '@/components/assign-modal';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, LoadingBlock } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime, fmtNumber, WEEKDAYS_SHORT } from '@/lib/format';

export function WorkoutsTab({ studentId }: { studentId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [assign, setAssign] = useState<{ workout?: AssignedWorkout } | null>(null);
  const list = useQuery({ queryKey: ['student-workouts', studentId], queryFn: () => api<AssignedWorkout[]>(`/students/${studentId}/workouts`) });
  const history = useQuery({
    queryKey: ['sessions', studentId],
    queryFn: () => api<Paginated<SessionHistoryItem>>('/sessions', { query: { studentId, pageSize: 10 } }),
  });
  const unassign = useMutation({
    mutationFn: (workoutId: string) => api(`/workouts/${workoutId}/assign/${studentId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Treino removido do aluno');
      qc.invalidateQueries({ queryKey: ['student-workouts', studentId] });
      qc.invalidateQueries({ queryKey: ['workouts'] });
    },
    onError: (e) => toast.error('Erro', errorMessage(e)),
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">{list.data?.length ?? 0} treino(s) atribuído(s)</p>
          <Button onClick={() => setAssign({})}>
            <Plus className="size-4" /> Atribuir treino
          </Button>
        </div>
        {list.isLoading ? (
          <LoadingBlock />
        ) : list.isError ? (
          <ErrorState error={list.error} />
        ) : list.data!.length === 0 ? (
          <Card>
            <EmptyState icon={<Dumbbell className="size-5" />} title="Nenhum treino atribuído" description="Atribua uma ficha da sua biblioteca e defina os dias da semana." />
          </Card>
        ) : (
          list.data!.map((w) => (
            <Card key={w.assignmentId} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-lg font-bold text-accent-ink">{w.label ?? '•'}</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{w.name}</p>
                    <p className="text-xs text-muted">{w.exercises.length} exercícios</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Link href={`/professor/treinos/${w.id}`} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg" title="Editar treino">
                    <Pencil className="size-4" />
                  </Link>
                  <Button size="icon" variant="ghost" title="Dias da semana" onClick={() => setAssign({ workout: w })}>
                    <CalendarDays className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" title="Remover do aluno" onClick={() => confirm(`Remover "${w.name}" deste aluno?`) && unassign.mutate(w.id)}>
                    <Unlink className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {w.weekdays.length === 0 ? (
                  <Badge>Sem dia fixo</Badge>
                ) : (
                  [...w.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => <Badge key={d} tone="accent">{WEEKDAYS_SHORT[d]}</Badge>)
                )}
              </div>
              <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                {w.exercises.map((e, i) => (
                  <li key={e.id} className="flex justify-between gap-2">
                    <span className="truncate text-muted">
                      {i + 1}. <span className="text-fg">{e.exercise.name}</span>
                    </span>
                    <span className="tabular shrink-0 text-xs text-muted">
                      {e.sets}×{e.reps}
                      {e.suggestedLoadKg !== null && Number(e.suggestedLoadKg) > 0 ? ` · ${fmtNumber(Number(e.suggestedLoadKg))} kg` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>
      <Card className="h-fit">
        <CardHeader title="Histórico de treinos" subtitle="Últimas sessões" icon={<History className="size-4" />} />
        <CardBody>
          {history.isLoading ? (
            <LoadingBlock />
          ) : !history.data?.items.length ? (
            <p className="py-4 text-center text-sm text-muted">Nenhuma sessão registrada.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.data.items.map((h) => (
                <li key={h.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{h.workout?.name ?? 'Treino'}</p>
                    {!h.finishedAt && <Badge tone="warning">Em andamento</Badge>}
                  </div>
                  <p className="tabular mt-0.5 text-xs text-muted">
                    {fmtDateTime(h.startedAt)} · {h.durationSeconds ? formatDuration(h.durationSeconds) : '—'} · {fmtNumber(h.totalVolumeKg ?? 0, 0)} kg · {h.setsCount} séries
                    {h.perceivedEffort ? ` · PSE ${h.perceivedEffort}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      {assign && <AssignModal studentId={studentId} workout={assign.workout} initialWeekdays={assign.workout?.weekdays} onClose={() => setAssign(null)} />}
    </div>
  );
}
