'use client';

import { MUSCLE_GROUP_LABELS, type Exercise, type MuscleGroup } from '@personalpro/shared';
import { useQuery } from '@tanstack/react-query';
import { Check, Search } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Badge, Button, Chip, Input, LoadingBlock, Modal } from './ui';

export const MUSCLE_GROUPS = Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[];

export function useExercises(muscleGroup: MuscleGroup | '', search: string, scope: 'all' | 'library' | 'custom' = 'all') {
  return useQuery({
    queryKey: ['exercises', muscleGroup, search, scope],
    queryFn: () => api<Exercise[]>('/exercises', { query: { muscleGroup, search, scope } }),
    placeholderData: (p) => p,
  });
}

export function ExercisePicker({ onClose, onPick }: { onClose: () => void; onPick: (list: Exercise[]) => void }) {
  const [group, setGroup] = useState<MuscleGroup | ''>('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Exercise[]>([]);
  const list = useExercises(group, search);

  const toggle = (e: Exercise) => setSelected((prev) => (prev.some((x) => x.id === e.id) ? prev.filter((x) => x.id !== e.id) : [...prev, e]));

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Adicionar exercícios"
      description="Filtre por grupo muscular e selecione um ou mais exercícios."
      footer={
        <>
          <span className="mr-auto self-center text-sm text-muted">{selected.length} selecionado(s)</span>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!selected.length} onClick={() => onPick(selected)}>
            Adicionar
          </Button>
        </>
      }
    >
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar exercício" className="pl-10" autoFocus />
      </div>
      <div className="-mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5 pb-1">
        <Chip active={group === ''} onClick={() => setGroup('')}>
          Todos
        </Chip>
        {MUSCLE_GROUPS.map((g) => (
          <Chip key={g} active={group === g} onClick={() => setGroup(g)}>
            {MUSCLE_GROUP_LABELS[g]}
          </Chip>
        ))}
      </div>
      {list.isLoading ? (
        <LoadingBlock />
      ) : (
        <ul className="space-y-1">
          {(list.data ?? []).map((e) => {
            const on = selected.some((x) => x.id === e.id);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => toggle(e)}
                  className={cn('flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition', on ? 'border-accent bg-accent-soft' : 'border-transparent hover:bg-surface-2')}
                >
                  <span className={cn('grid size-5 shrink-0 place-items-center rounded-md border', on ? 'border-accent bg-accent text-accent-fg' : 'border-border-strong')}>
                    {on && <Check className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{e.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {MUSCLE_GROUP_LABELS[e.muscleGroup]}
                      {e.equipment ? ` · ${e.equipment}` : ''}
                    </span>
                  </span>
                  {e.trainerId && <Badge tone="info">Meu</Badge>}
                </button>
              </li>
            );
          })}
          {list.data?.length === 0 && <p className="py-8 text-center text-sm text-muted">Nenhum exercício encontrado.</p>}
        </ul>
      )}
    </Modal>
  );
}
