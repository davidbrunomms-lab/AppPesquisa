'use client';

import { MUSCLE_GROUP_LABELS, TECHNIQUE_LABELS, type Exercise, type TrainingTechnique, type Workout } from '@personalpro/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Dumbbell, Link2, Plus, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ExercisePicker } from './exercise-picker';
import { useToast } from './toast';
import { Button, Card, CardBody, CardHeader, Checkbox, Chip, EmptyState, Field, Input, Select, Textarea } from './ui';

interface Item {
  key: string;
  id?: string;
  exercise: Pick<Exercise, 'id' | 'name' | 'muscleGroup' | 'equipment'>;
  sets: string;
  reps: string;
  load: string;
  rest: string;
  technique: TrainingTechnique;
  groupKey: string;
  notes: string;
}

const LABELS = ['A', 'B', 'C', 'D', 'E'];
const GROUP_TECHNIQUES: TrainingTechnique[] = ['BI_SET', 'TRI_SET', 'SUPERSET'];
const GROUP_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
let seq = 0;
const newKey = () => `n${++seq}`;

export function WorkoutBuilder({ workout }: { workout?: Workout }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(workout?.name ?? '');
  const [label, setLabel] = useState(workout?.label ?? '');
  const [description, setDescription] = useState(workout?.description ?? '');
  const [isTemplate, setIsTemplate] = useState(workout?.isTemplate ?? true);
  const [items, setItems] = useState<Item[]>(
    (workout?.exercises ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((e) => ({
        key: e.id,
        id: e.id,
        exercise: e.exercise,
        sets: String(e.sets),
        reps: e.reps,
        load: e.suggestedLoadKg === null || e.suggestedLoadKg === undefined ? '' : String(Number(e.suggestedLoadKg)),
        rest: String(e.restSeconds),
        technique: e.technique,
        groupKey: e.groupKey ?? '',
        notes: e.notes ?? '',
      })),
  );
  const [picker, setPicker] = useState(false);

  const update = (key: string, patch: Partial<Item>) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const move = (idx: number, dir: -1 | 1) =>
    setItems((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const groups = [...new Set(items.map((i) => i.groupKey.trim()).filter(Boolean))];

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        label: label.trim() || undefined,
        description: description.trim() || undefined,
        isTemplate,
        exercises: items.map((i) => ({
          id: i.id,
          exerciseId: i.exercise.id,
          sets: Number(i.sets) || 1,
          reps: i.reps.trim() || '10',
          suggestedLoadKg: i.load.trim() === '' ? undefined : Number(i.load.replace(',', '.')),
          restSeconds: Number(i.rest) || 0,
          technique: i.technique,
          groupKey: i.groupKey.trim() || undefined,
          notes: i.notes.trim() || undefined,
        })),
      };
      return workout ? api<Workout>(`/workouts/${workout.id}`, { method: 'PUT', body }) : api<Workout>('/workouts', { method: 'POST', body });
    },
    onSuccess: (w) => {
      toast.success(workout ? 'Treino atualizado' : 'Treino criado', workout ? 'Alunos com este treino foram notificados.' : undefined);
      qc.invalidateQueries({ queryKey: ['workouts'] });
      qc.invalidateQueries({ queryKey: ['workout', w.id] });
      qc.invalidateQueries({ queryKey: ['student-workouts'] });
      router.push('/professor/treinos');
    },
    onError: (e) => toast.error('Não foi possível salvar', errorMessage(e)),
  });

  const customLabel = label && !LABELS.includes(label);

  return (
    <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
      <Card className="h-fit xl:sticky xl:top-24">
        <CardHeader title="Informações do treino" />
        <CardBody className="space-y-4">
          <Input label="Nome do treino *" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Treino A — Peito e tríceps" />
          <Field label="Divisão">
            <div className="flex flex-wrap gap-1.5">
              {LABELS.map((l) => (
                <Chip key={l} active={label === l} onClick={() => setLabel(label === l ? '' : l)} className="w-10 justify-center">
                  {l}
                </Chip>
              ))}
              <input
                value={customLabel ? label : ''}
                onChange={(e) => setLabel(e.target.value.slice(0, 12))}
                placeholder="Outro"
                className={cn('h-8 w-24 rounded-full border bg-surface-2 px-3 text-xs outline-none focus:border-accent', customLabel ? 'border-accent' : 'border-border')}
              />
            </div>
          </Field>
          <Textarea label="Descrição / orientações gerais" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-20" />
          <Checkbox checked={isTemplate} onChange={setIsTemplate}>
            Salvar como modelo reutilizável na biblioteca
          </Checkbox>
          <div className="rounded-xl bg-surface-2 p-3 text-xs text-muted">
            <p>
              <span className="font-semibold text-fg">{items.length}</span> exercícios ·{' '}
              <span className="font-semibold text-fg">{items.reduce((a, i) => a + (Number(i.sets) || 0), 0)}</span> séries
            </p>
            <p className="mt-1">Use o mesmo <strong>grupo</strong> (ex.: A1) para combinar exercícios em bi-set, tri-set ou supersérie.</p>
          </div>
          <Button size="lg" className="w-full" loading={save.isPending} disabled={!name.trim() || items.length === 0} onClick={() => save.mutate()}>
            <Save className="size-4" /> Salvar treino
          </Button>
        </CardBody>
      </Card>

      <div className="space-y-3">
        {items.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Dumbbell className="size-5" />}
              title="Nenhum exercício ainda"
              description="Adicione exercícios da biblioteca filtrando por grupo muscular."
              action={
                <Button onClick={() => setPicker(true)}>
                  <Plus className="size-4" /> Adicionar exercícios
                </Button>
              }
            />
          </Card>
        ) : (
          items.map((i, idx) => {
            const g = i.groupKey.trim();
            const gi = g ? groups.indexOf(g) : -1;
            return (
              <Card key={i.key} className="relative overflow-hidden p-4">
                {gi >= 0 && <span className="absolute inset-y-0 left-0 w-1" style={{ background: GROUP_COLORS[gi % GROUP_COLORS.length] }} />}
                <div className="flex items-start gap-3">
                  <span className="tabular grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-sm font-semibold">{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{i.exercise.name}</p>
                    <p className="text-xs text-muted">
                      {MUSCLE_GROUP_LABELS[i.exercise.muscleGroup]}
                      {i.exercise.equipment ? ` · ${i.exercise.equipment}` : ''}
                      {g && (
                        <span className="ml-1.5 inline-flex items-center gap-1 font-medium text-fg">
                          <Link2 className="size-3" /> Grupo {g}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0">
                    <Button size="icon" variant="ghost" aria-label="Mover para cima" disabled={idx === 0} onClick={() => move(idx, -1)}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Mover para baixo" disabled={idx === items.length - 1} onClick={() => move(idx, 1)}>
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Remover" onClick={() => setItems((p) => p.filter((x) => x.key !== i.key))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.5fr)_minmax(0,0.8fr)]">
                  <Input label="Séries" type="number" min={1} value={i.sets} onChange={(e) => update(i.key, { sets: e.target.value })} />
                  <Input label="Repetições" value={i.reps} onChange={(e) => update(i.key, { reps: e.target.value })} placeholder="8-12" />
                  <Input label="Carga sug. (kg)" inputMode="decimal" value={i.load} onChange={(e) => update(i.key, { load: e.target.value })} />
                  <Input label="Descanso (s)" type="number" min={0} step={5} value={i.rest} onChange={(e) => update(i.key, { rest: e.target.value })} />
                  <Select
                    label="Técnica"
                    value={i.technique}
                    onChange={(e) => {
                      const t = e.target.value as TrainingTechnique;
                      update(i.key, { technique: t, groupKey: GROUP_TECHNIQUES.includes(t) && !i.groupKey ? `G${Math.max(groups.length, 0) + 1}` : i.groupKey });
                    }}
                    options={Object.entries(TECHNIQUE_LABELS).map(([value, l]) => ({ value, label: l }))}
                  />
                  <Input label="Grupo" value={i.groupKey} onChange={(e) => update(i.key, { groupKey: e.target.value.toUpperCase().slice(0, 8) })} placeholder="ex.: A1" />
                </div>
                <Input value={i.notes} onChange={(e) => update(i.key, { notes: e.target.value })} placeholder="Observações (cadência, amplitude, ajuste do banco…)" className="mt-2.5 h-10" />
              </Card>
            );
          })
        )}
        {items.length > 0 && (
          <Button variant="secondary" className="w-full border-dashed" size="lg" onClick={() => setPicker(true)}>
            <Plus className="size-4" /> Adicionar exercícios
          </Button>
        )}
      </div>

      {picker && (
        <ExercisePicker
          onClose={() => setPicker(false)}
          onPick={(list) => {
            setItems((prev) => [
              ...prev,
              ...list.map((e) => ({ key: newKey(), exercise: e, sets: '3', reps: '10-12', load: '', rest: '60', technique: 'NORMAL' as TrainingTechnique, groupKey: '', notes: '' })),
            ]);
            setPicker(false);
          }}
        />
      )}
    </div>
  );
}
