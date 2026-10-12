'use client';

import { MUSCLE_GROUP_LABELS, type Workout } from '@personalpro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Copy, Dumbbell, Pencil, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AssignModal } from '@/components/assign-modal';
import { useToast } from '@/components/toast';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, LinkButton, LoadingBlock, PageHeader, Segmented } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';

export default function WorkoutsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'templates'>('all');
  const [assign, setAssign] = useState<Workout | null>(null);
  const workouts = useQuery({ queryKey: ['workouts'], queryFn: () => api<Workout[]>('/workouts') });

  const duplicate = useMutation({
    mutationFn: (id: string) => api<Workout>(`/workouts/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Treino duplicado');
      qc.invalidateQueries({ queryKey: ['workouts'] });
    },
    onError: (e) => toast.error('Erro ao duplicar', errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/workouts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Treino excluído');
      qc.invalidateQueries({ queryKey: ['workouts'] });
    },
    onError: (e) => toast.error('Erro ao excluir', errorMessage(e)),
  });

  const list = (workouts.data ?? []).filter(
    (w) => (filter === 'all' || w.isTemplate) && (!search || w.name.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div>
      <PageHeader
        title="Treinos"
        subtitle="Monte fichas, reutilize modelos e atribua aos alunos"
        actions={
          <>
            <LinkButton href="/professor/exercicios" variant="secondary">
              <BookOpen className="size-4" /> Exercícios
            </LinkButton>
            <LinkButton href="/professor/treinos/novo">
              <Plus className="size-4" /> Novo treino
            </LinkButton>
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar treino" className="pl-10" />
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'templates', label: 'Modelos' },
          ]}
          className="h-11 items-center"
        />
      </div>

      {workouts.isLoading ? (
        <LoadingBlock />
      ) : workouts.isError ? (
        <ErrorState error={workouts.error} onRetry={() => workouts.refetch()} />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Dumbbell className="size-5" />}
            title="Nenhum treino encontrado"
            description="Crie sua primeira ficha de treino para atribuir aos alunos."
            action={
              <LinkButton href="/professor/treinos/novo">
                <Plus className="size-4" /> Novo treino
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((w) => {
            const groups = [...new Set(w.exercises.map((e) => e.exercise.muscleGroup))];
            const assigned = (w.studentWorkouts ?? []).filter((s) => s.active);
            return (
              <Card key={w.id} className="flex flex-col p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-lg font-bold text-accent-ink">{w.label ?? <Dumbbell className="size-5" />}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/professor/treinos/${w.id}`} className="line-clamp-2 font-semibold hover:underline">
                      {w.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">
                      {w.exercises.length} exercícios · {w.exercises.reduce((a, e) => a + e.sets, 0)} séries
                    </p>
                  </div>
                  {w.isTemplate && <Badge tone="info">Modelo</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {groups.slice(0, 5).map((g) => (
                    <Badge key={g}>{MUSCLE_GROUP_LABELS[g]}</Badge>
                  ))}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3" style={{ marginTop: 16 }}>
                  <div className="flex items-center -space-x-2">
                    {assigned.slice(0, 4).map((s) => (
                      <Avatar key={s.studentId} name={s.student.user.name} src={s.student.user.avatarUrl} size={26} className="ring-2 ring-surface" />
                    ))}
                    {assigned.length === 0 && <span className="text-xs text-subtle">Não atribuído</span>}
                    {assigned.length > 4 && <span className="pl-3 text-xs text-muted">+{assigned.length - 4}</span>}
                  </div>
                  <div className="flex gap-0.5">
                    <Button size="icon" variant="ghost" title="Atribuir a aluno" onClick={() => setAssign(w)}>
                      <UserPlus className="size-4" />
                    </Button>
                    <Link href={`/professor/treinos/${w.id}`} title="Editar" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
                      <Pencil className="size-4" />
                    </Link>
                    <Button size="icon" variant="ghost" title="Duplicar" onClick={() => duplicate.mutate(w.id)}>
                      <Copy className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Excluir" onClick={() => confirm(`Excluir "${w.name}"? Alunos com este treino deixarão de vê-lo.`) && remove.mutate(w.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {assign && <AssignModal workout={assign} onClose={() => setAssign(null)} />}
    </div>
  );
}
