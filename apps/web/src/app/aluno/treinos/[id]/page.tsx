'use client';

import { MUSCLE_GROUP_LABELS, TECHNIQUE_LABELS, type Workout } from '@personalpro/shared';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ChevronDown, Dumbbell, Link2, Play, Timer } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Badge, Card, ErrorState, LinkButton, LoadingBlock } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtNumber } from '@/lib/format';

export default function StudentWorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ['workout', id], queryFn: () => api<Workout>(`/workouts/${id}`) });
  const [open, setOpen] = useState<string | null>(null);

  if (q.isLoading) return <LoadingBlock />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const w = q.data!;
  const exercises = [...w.exercises].sort((a, b) => a.order - b.order);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/aluno/treinos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Meus treinos
      </Link>
      <div className="mb-5 flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-accent text-3xl font-bold text-accent-fg">{w.label ?? <Dumbbell className="size-7" />}</span>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{w.name}</h1>
          <p className="text-sm text-muted">
            {exercises.length} exercícios · {exercises.reduce((a, e) => a + e.sets, 0)} séries
          </p>
        </div>
      </div>
      {w.description && <p className="mb-4 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">{w.description}</p>}

      <div className="space-y-2.5">
        {exercises.map((e, i) => {
          const expanded = open === e.id;
          const load = e.suggestedLoadKg === null ? null : Number(e.suggestedLoadKg);
          return (
            <Card key={e.id} className="overflow-hidden">
              <button type="button" onClick={() => setOpen(expanded ? null : e.id)} className="flex w-full items-center gap-3 p-4 text-left">
                <span className="tabular grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-sm font-semibold">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{e.exercise.name}</p>
                  <p className="tabular text-xs text-muted">
                    {e.sets} séries × {e.reps} reps{load ? ` · ${fmtNumber(load)} kg` : ''} · descanso {e.restSeconds}s
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Badge>{MUSCLE_GROUP_LABELS[e.exercise.muscleGroup]}</Badge>
                    {e.technique !== 'NORMAL' && <Badge tone="info">{TECHNIQUE_LABELS[e.technique]}</Badge>}
                    {e.groupKey && (
                      <Badge tone="accent">
                        <Link2 className="size-3" /> {e.groupKey}
                      </Badge>
                    )}
                  </div>
                </div>
                <ChevronDown className={cn('size-4 shrink-0 text-muted transition', expanded && 'rotate-180')} />
              </button>
              {expanded && (
                <div className="space-y-3 border-t border-border p-4 text-sm">
                  {e.exercise.videoUrl ? (
                    <video src={e.exercise.videoUrl} controls poster={e.exercise.imageUrl ?? undefined} className="aspect-video w-full rounded-xl bg-black" />
                  ) : e.exercise.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.exercise.imageUrl} alt={e.exercise.name} className="max-h-72 w-full rounded-xl object-cover" />
                  ) : null}
                  {e.notes && <p className="rounded-xl bg-accent-soft p-3 text-accent-ink">📝 {e.notes}</p>}
                  {e.exercise.instructions.length > 0 && (
                    <ol className="list-decimal space-y-1 pl-5 text-muted">
                      {e.exercise.instructions.map((s, k) => (
                        <li key={k}>{s}</li>
                      ))}
                    </ol>
                  )}
                  {e.exercise.commonMistakes.length > 0 && (
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-warning">
                        <AlertTriangle className="size-3.5" /> Evite
                      </p>
                      <ul className="space-y-0.5 text-muted">
                        {e.exercise.commonMistakes.map((s, k) => (
                          <li key={k}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="flex items-center gap-1.5 text-xs text-subtle">
                    <Timer className="size-3.5" /> Descanso entre séries: {e.restSeconds} segundos
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
      <div className="pb-safe sticky bottom-20 z-10 mt-5 lg:bottom-4">
        <LinkButton href={`/aluno/treinos/${w.id}/executar`} size="lg" className="w-full shadow-card">
          <Play className="size-5 fill-current" /> INICIAR TREINO
        </LinkButton>
      </div>
    </div>
  );
}
