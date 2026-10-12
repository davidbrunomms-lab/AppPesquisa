'use client';

import type { Exercise, Goal, GoalType } from '@personalpro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { fmtDate, fmtNumber, toInputDate } from '@/lib/format';
import { useToast } from './toast';
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingBlock, Modal, ProgressBar, Select } from './ui';

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  BODY_WEIGHT: 'Peso corporal',
  BODY_FAT: '% de gordura',
  WEEKLY_FREQUENCY: 'Frequência semanal',
  EXERCISE_LOAD: 'Carga em exercício',
  CUSTOM: 'Personalizada',
};
const GOAL_UNITS: Record<GoalType, string> = { BODY_WEIGHT: 'kg', BODY_FAT: '%', WEEKLY_FREQUENCY: 'treinos', EXERCISE_LOAD: 'kg', CUSTOM: '' };

export function GoalCard({ goal, actions }: { goal: Goal; actions?: React.ReactNode }) {
  const pct = Math.round(goal.progressPct);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{goal.title}</p>
            {goal.status === 'ACHIEVED' && (
              <Badge tone="success">
                <CheckCircle2 className="size-3" /> Atingida
              </Badge>
            )}
            {goal.status === 'CANCELED' && <Badge>Cancelada</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {GOAL_TYPE_LABELS[goal.type]}
            {goal.exerciseName ? ` · ${goal.exerciseName}` : ''}
            {goal.deadline ? ` · até ${fmtDate(goal.deadline)}` : ''}
          </p>
        </div>
        {actions}
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <p className="tabular text-sm text-muted">
          <span className="text-lg font-semibold text-fg">{fmtNumber(goal.currentValue)}</span> / {fmtNumber(goal.targetValue)} {goal.unit}
        </p>
        <p className="tabular text-sm font-semibold text-accent-ink">{pct}%</p>
      </div>
      <ProgressBar value={pct} className="mt-2" />
      <p className="mt-1.5 text-[11px] text-subtle">
        Início: {fmtNumber(goal.startValue)} {goal.unit}
      </p>
    </Card>
  );
}

export function GoalsPanel({ studentId, editable }: { studentId?: string; editable?: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const goals = useQuery({
    queryKey: ['goals', studentId ?? 'me'],
    queryFn: () => api<Goal[]>('/goals', { query: studentId ? { studentId } : undefined }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/goals/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Meta excluída');
      qc.invalidateQueries({ queryKey: ['goals'] });
    },
    onError: (e) => toast.error('Erro ao excluir', errorMessage(e)),
  });

  if (goals.isLoading) return <LoadingBlock />;
  if (goals.isError) return <ErrorState error={goals.error} onRetry={() => goals.refetch()} />;
  const list = goals.data ?? [];

  return (
    <div className="space-y-4">
      {editable && (
        <div className="flex justify-end">
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Nova meta
          </Button>
        </div>
      )}
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<Target className="size-5" />} title="Nenhuma meta definida" description={editable ? 'Crie metas de peso, gordura, frequência ou carga para acompanhar o progresso.' : 'Seu professor ainda não definiu metas para você.'} />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              actions={
                editable && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" aria-label="Editar meta" onClick={() => setEditing(g)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Excluir meta"
                      onClick={() => confirm(`Excluir a meta "${g.title}"?`) && remove.mutate(g.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )
              }
            />
          ))}
        </div>
      )}
      {editable && studentId && editing && <GoalModal studentId={studentId} goal={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function GoalModal({ studentId, goal, onClose }: { studentId: string; goal: Goal | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [type, setType] = useState<GoalType>(goal?.type ?? 'BODY_WEIGHT');
  const [title, setTitle] = useState(goal?.title ?? '');
  const [target, setTarget] = useState(goal ? String(goal.targetValue) : '');
  const [start, setStart] = useState(goal ? String(goal.startValue) : '');
  const [current, setCurrent] = useState(goal ? String(goal.currentValue) : '');
  const [unit, setUnit] = useState(goal?.unit ?? '');
  const [deadline, setDeadline] = useState(toInputDate(goal?.deadline));
  const [exerciseId, setExerciseId] = useState(goal?.exerciseId ?? '');
  const [status, setStatus] = useState(goal?.status ?? 'ACTIVE');
  const exercises = useQuery({ enabled: type === 'EXERCISE_LOAD' && !goal, queryKey: ['exercises', 'all'], queryFn: () => api<Exercise[]>('/exercises') });

  const save = useMutation({
    mutationFn: () => {
      const deadlineIso = deadline ? new Date(`${deadline}T12:00:00`).toISOString() : undefined;
      if (goal) {
        return api(`/goals/${goal.id}`, {
          method: 'PATCH',
          body: {
            title: title || undefined,
            targetValue: Number(target),
            currentValue: type === 'CUSTOM' && current !== '' ? Number(current) : undefined,
            deadline: deadlineIso,
            status,
          },
        });
      }
      return api('/goals', {
        method: 'POST',
        body: {
          studentId,
          type,
          targetValue: Number(target),
          startValue: start !== '' ? Number(start) : undefined,
          exerciseId: type === 'EXERCISE_LOAD' ? exerciseId || undefined : undefined,
          title: title || undefined,
          unit: type === 'CUSTOM' ? unit || undefined : undefined,
          deadline: deadlineIso,
        },
      });
    },
    onSuccess: () => {
      toast.success(goal ? 'Meta atualizada' : 'Meta criada');
      qc.invalidateQueries({ queryKey: ['goals'] });
      onClose();
    },
    onError: (e) => toast.error('Não foi possível salvar', errorMessage(e)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={goal ? 'Editar meta' : 'Nova meta'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={save.isPending} disabled={!target || (type === 'EXERCISE_LOAD' && !goal && !exerciseId)} onClick={() => save.mutate()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Tipo"
          value={type}
          disabled={!!goal}
          onChange={(e) => setType(e.target.value as GoalType)}
          options={Object.entries(GOAL_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          wrapperClassName="sm:col-span-2"
        />
        {type === 'EXERCISE_LOAD' && !goal && (
          <Select
            label="Exercício"
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            placeholder="Selecione…"
            options={(exercises.data ?? []).map((x) => ({ value: x.id, label: x.name }))}
            wrapperClassName="sm:col-span-2"
          />
        )}
        <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Gerado automaticamente se vazio" wrapperClassName="sm:col-span-2" />
        <Input label={`Valor alvo ${GOAL_UNITS[type] ? `(${GOAL_UNITS[type]})` : ''}`} type="number" step="0.1" value={target} onChange={(e) => setTarget(e.target.value)} required />
        {!goal ? (
          <Input label="Valor inicial" type="number" step="0.1" value={start} onChange={(e) => setStart(e.target.value)} hint="Vazio = valor atual do aluno" />
        ) : (
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Goal['status'])}
            options={[
              { value: 'ACTIVE', label: 'Ativa' },
              { value: 'ACHIEVED', label: 'Atingida' },
              { value: 'CANCELED', label: 'Cancelada' },
            ]}
          />
        )}
        {type === 'CUSTOM' && !goal && <Input label="Unidade" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ex.: km, min" />}
        {type === 'CUSTOM' && goal && <Input label="Valor atual" type="number" step="0.1" value={current} onChange={(e) => setCurrent(e.target.value)} />}
        <Input label="Prazo" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </div>
    </Modal>
  );
}
