'use client';

import {
  MUSCLE_GROUP_LABELS,
  TECHNIQUE_LABELS,
  formatDuration,
  parseTargetReps,
  type ExecutionView,
  type FinishSessionResponse,
  type LogSetResponse,
} from '@personalpro/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, Dumbbell, Flame, History, Link2, Plus, SkipForward, Timer, Trash2, Trophy, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, ErrorState, Input, LinkButton, LoadingBlock, Modal, Textarea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtNumber } from '@/lib/format';

type Ex = ExecutionView['exercises'][number];
interface Draft {
  load: string;
  reps: string;
  rpe: string;
  notes: string;
}

export default function ExecuteWorkoutPage() {
  const { id: workoutId } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [session, setSession] = useState<ExecutionView | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [idx, setIdx] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [rest, setRest] = useState<{ endsAt: number; total: number; next?: number } | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [summary, setSummary] = useState<FinishSessionResponse['summary'] | null>(null);
  const started = useRef(false);

  const start = useCallback(async () => {
    setError(null);
    try {
      const s = await api<ExecutionView>('/sessions', { method: 'POST', body: { workoutId } });
      setSession(s);
      // Retoma do primeiro exercício incompleto.
      const firstOpen = s.exercises.findIndex((e) => e.today.length < e.sets);
      setIdx(firstOpen >= 0 ? firstOpen : 0);
    } catch (err) {
      setError(err);
    }
  }, [workoutId]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  const ex = session?.exercises[idx];

  // Pré-preenche carga/reps: hoje > anterior > sugerida.
  useEffect(() => {
    if (!ex || drafts[ex.workoutExerciseId]) return;
    setDrafts((d) => ({ ...d, [ex.workoutExerciseId]: defaultDraft(ex) }));
  }, [ex, drafts]);

  const draft = ex ? drafts[ex.workoutExerciseId] ?? defaultDraft(ex) : null;
  const setDraft = (patch: Partial<Draft>) => ex && setDrafts((d) => ({ ...d, [ex.workoutExerciseId]: { ...(d[ex.workoutExerciseId] ?? defaultDraft(ex)), ...patch } }));

  const logSet = useMutation({
    mutationFn: (body: { exerciseId: string; workoutExerciseId: string; setNumber: number; loadKg: number; reps: number; rpe?: number; notes?: string }) =>
      api<LogSetResponse>(`/sessions/${session!.id}/sets`, { method: 'POST', body }),
    onSuccess: (res) => {
      if (!session || !ex) return;
      const updated = { ...session, exercises: session.exercises.map((e) => (e.workoutExerciseId === ex.workoutExerciseId ? { ...e, today: [...e.today, res.set] } : e)) };
      setSession(updated);
      if (res.isPersonalRecord) toast.show({ kind: 'record', title: 'Novo recorde pessoal! 🏆', description: `${ex.name}: ${fmtNumber(res.set.loadKg)} kg × ${res.set.reps}` }, 5000);
      setDraft({ notes: '', rpe: '' });
      const doneNow = ex.today.length + 1 >= ex.sets;
      const nextIdx = doneNow ? updated.exercises.findIndex((e, i) => i > idx && e.today.length < e.sets) : undefined;
      const allDone = updated.exercises.every((e) => e.today.length >= e.sets);
      if (allDone) {
        toast.success('Todas as séries concluídas!', 'Finalize o treino para ver o resumo.');
        return;
      }
      if (res.restSeconds > 0) setRest({ endsAt: Date.now() + res.restSeconds * 1000, total: res.restSeconds, next: nextIdx !== undefined && nextIdx >= 0 ? nextIdx : undefined });
      else if (nextIdx !== undefined && nextIdx >= 0) setIdx(nextIdx);
    },
    onError: (e) => toast.error('Série não registrada', errorMessage(e)),
  });

  const removeSet = useMutation({
    mutationFn: (setId: string) => api(`/sessions/${session!.id}/sets/${setId}`, { method: 'DELETE' }),
    onSuccess: (_, setId) => {
      if (!session) return;
      setSession({ ...session, exercises: session.exercises.map((e) => ({ ...e, today: e.today.filter((s) => s.id !== setId) })) });
    },
    onError: (e) => toast.error('Erro ao remover série', errorMessage(e)),
  });

  const finish = useMutation({
    mutationFn: (body: { perceivedEffort?: number; notes?: string }) => api<FinishSessionResponse>(`/sessions/${session!.id}/finish`, { method: 'POST', body }),
    onSuccess: (res) => {
      setFinishOpen(false);
      setRest(null);
      setSummary(res.summary);
      window.scrollTo({ top: 0 });
      ['dashboard-student', 'progress-stats', 'progress-exercises', 'sessions', 'goals', 'my-workouts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e) => toast.error('Não foi possível finalizar', errorMessage(e)),
  });

  const abandon = useMutation({
    mutationFn: () => api(`/sessions/${session!.id}/abandon`, { method: 'POST' }),
    onSuccess: () => {
      toast.info('Treino descartado');
      router.replace('/aluno');
    },
    onError: (e) => toast.error('Erro', errorMessage(e)),
  });

  if (summary) return <Summary summary={summary} name={session?.workout?.name ?? 'Treino'} />;
  if (error) return <ErrorState error={error} onRetry={start} />;
  if (!session || !ex || !draft) return <LoadingBlock label="Preparando seu treino…" className="min-h-[60dvh]" />;

  const totalSets = session.exercises.reduce((a, e) => a + e.sets, 0);
  const doneSets = session.exercises.reduce((a, e) => a + Math.min(e.today.length, e.sets), 0);
  const setNumber = ex.today.length + 1;
  const prevSet = ex.previous?.sets.find((s) => s.setNumber === setNumber) ?? ex.previous?.sets[ex.previous.sets.length - 1];

  const submitSet = () => {
    const loadKg = Number(draft.load.replace(',', '.'));
    const reps = Number(draft.reps);
    if (!Number.isFinite(loadKg) || loadKg < 0 || !reps || reps < 1) return toast.error('Informe carga e repetições válidas');
    logSet.mutate({
      exerciseId: ex.exerciseId,
      workoutExerciseId: ex.workoutExerciseId,
      setNumber,
      loadKg,
      reps,
      rpe: draft.rpe ? Number(draft.rpe) : undefined,
      notes: draft.notes.trim() || undefined,
    });
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Cabeçalho do treino */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/aluno" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" /> Sair
        </Link>
        <Elapsed startedAt={session.startedAt} />
      </div>
      <div className="mb-3">
        <p className="text-xs font-semibold tracking-wider text-accent-ink uppercase">{session.workout?.label ? `Treino ${session.workout.label}` : 'Treino'}</p>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{session.workout?.name}</h1>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(doneSets / Math.max(1, totalSets)) * 100}%` }} />
          </div>
          <span className="tabular text-xs text-muted">
            {doneSets}/{totalSets} séries
          </span>
        </div>
      </div>

      {/* Navegação entre exercícios */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {session.exercises.map((e, i) => {
          const complete = e.today.length >= e.sets;
          return (
            <button
              key={e.workoutExerciseId}
              type="button"
              onClick={() => setIdx(i)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-full border py-1.5 pr-3 pl-1.5 text-xs font-medium transition',
                i === idx ? 'border-accent bg-accent-soft text-fg' : 'border-border bg-surface text-muted',
              )}
            >
              <span className={cn('tabular grid size-6 place-items-center rounded-full text-[11px]', complete ? 'bg-accent text-accent-fg' : 'bg-surface-3')}>{complete ? <Check className="size-3.5" /> : i + 1}</span>
              <span className="max-w-32 truncate">{e.name}</span>
            </button>
          );
        })}
      </div>

      {/* Exercício atual */}
      <Card className="overflow-hidden">
        {(ex.videoUrl || ex.imageUrl) && (
          <div className="bg-black">
            {ex.videoUrl ? (
              <video key={ex.videoUrl} src={ex.videoUrl} controls muted playsInline loop poster={ex.imageUrl ?? undefined} className="mx-auto aspect-video max-h-72 w-full object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ex.imageUrl!} alt={ex.name} className="mx-auto max-h-72 w-full object-contain" />
            )}
          </div>
        )}
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{ex.name}</h2>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge>{MUSCLE_GROUP_LABELS[ex.muscleGroup]}</Badge>
                {ex.technique !== 'NORMAL' && <Badge tone="info">{TECHNIQUE_LABELS[ex.technique]}</Badge>}
                {ex.groupKey && (
                  <Badge tone="accent">
                    <Link2 className="size-3" /> Grupo {ex.groupKey}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="icon" variant="secondary" aria-label="Exercício anterior" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="icon" variant="secondary" aria-label="Próximo exercício" disabled={idx === session.exercises.length - 1} onClick={() => setIdx(idx + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Info label="Séries" value={`${Math.min(ex.today.length, ex.sets)}/${ex.sets}`} />
            <Info label="Repetições" value={ex.reps} />
            <Info label="Carga recomendada" value={ex.suggestedLoadKg ? `${fmtNumber(ex.suggestedLoadKg)} kg` : '—'} highlight />
            <Info
              label="Carga anterior"
              value={prevSet ? `${fmtNumber(prevSet.loadKg)} kg × ${prevSet.reps}` : '—'}
              sub={ex.previous ? fmtDate(ex.previous.date) : undefined}
            />
          </dl>
          {ex.personalBest && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
              <Trophy className="size-3.5 text-warning" /> Recorde: {fmtNumber(ex.personalBest.loadKg)} kg × {ex.personalBest.reps}
            </p>
          )}
          {ex.notes && <p className="mt-3 rounded-xl bg-accent-soft p-3 text-sm text-accent-ink">📝 {ex.notes}</p>}
          {ex.instructions.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-xs font-medium text-muted">Como executar</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
                {ex.instructions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </details>
          )}

          {/* Séries de hoje */}
          <div className="mt-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted uppercase">
              <History className="size-3.5" /> Carga de hoje
            </p>
            <div className="space-y-1.5">
              {ex.today.map((s) => (
                <div key={s.id} className={cn('flex items-center gap-3 rounded-xl px-3 py-2 text-sm', s.isPersonalRecord ? 'bg-accent-soft' : 'bg-surface-2')}>
                  <span className="tabular grid size-6 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-fg">{s.setNumber}</span>
                  <span className="tabular flex-1 font-medium">
                    {fmtNumber(s.loadKg)} kg × {s.reps}
                    {s.rpe ? <span className="ml-2 text-xs text-muted">RPE {s.rpe}</span> : null}
                  </span>
                  {s.isPersonalRecord && <Trophy className="size-4 text-accent-ink" />}
                  <button type="button" aria-label="Remover série" onClick={() => removeSet.mutate(s.id)} className="grid size-7 place-items-center rounded-lg text-subtle hover:text-danger">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              {ex.today.length === 0 && <p className="text-sm text-subtle">Nenhuma série registrada ainda.</p>}
            </div>
          </div>

          {/* Entrada da próxima série */}
          <div className="mt-5 rounded-2xl border border-border bg-surface-2/60 p-4">
            <p className="mb-3 text-sm font-semibold">
              Série {setNumber}
              {setNumber > ex.sets && <span className="ml-2 text-xs font-normal text-muted">(extra)</span>}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Stepper label="Carga (kg)" value={draft.load} onChange={(v) => setDraft({ load: v })} step={2.5} decimal />
              <Stepper label="Repetições" value={draft.reps} onChange={(v) => setDraft({ reps: v })} step={1} />
              <Input label="RPE (1–10)" type="number" min={1} max={10} inputMode="numeric" value={draft.rpe} onChange={(e) => setDraft({ rpe: e.target.value })} className="text-center" />
            </div>
            <Input value={draft.notes} onChange={(e) => setDraft({ notes: e.target.value })} placeholder="Observações da série (opcional)" className="mt-2 h-10" />
            <Button size="lg" className="mt-3 w-full tracking-wide" loading={logSet.isPending} onClick={submitSet}>
              <Check className="size-5" /> CONCLUIR SÉRIE
            </Button>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-[auto_1fr] gap-2 pb-4">
        <Button variant="ghost" size="lg" onClick={() => confirm('Descartar este treino? As séries registradas serão perdidas.') && abandon.mutate()}>
          <X className="size-4" /> Descartar
        </Button>
        <Button size="lg" variant={doneSets >= totalSets ? 'primary' : 'secondary'} className="tracking-wide" onClick={() => setFinishOpen(true)} disabled={doneSets === 0}>
          <Flame className="size-5" /> FINALIZAR TREINO
        </Button>
      </div>

      {rest && (
        <RestOverlay
          rest={rest}
          nextName={rest.next !== undefined ? session.exercises[rest.next]?.name : undefined}
          onAdd={() => setRest((r) => (r ? { ...r, endsAt: r.endsAt + 15000, total: r.total + 15 } : r))}
          onDone={() => {
            if (rest.next !== undefined) setIdx(rest.next);
            setRest(null);
          }}
        />
      )}

      <FinishModal open={finishOpen} loading={finish.isPending} pending={totalSets - doneSets} onClose={() => setFinishOpen(false)} onConfirm={(b) => finish.mutate(b)} />
    </div>
  );
}

function defaultDraft(ex: Ex): Draft {
  const last = ex.today[ex.today.length - 1];
  const prev = ex.previous?.sets.find((s) => s.setNumber === ex.today.length + 1) ?? ex.previous?.sets[0];
  const load = last?.loadKg ?? prev?.loadKg ?? (ex.suggestedLoadKg !== null ? Number(ex.suggestedLoadKg) : null);
  const reps = last?.reps ?? parseTargetReps(ex.reps) ?? prev?.reps ?? null;
  return { load: load === null ? '' : String(load), reps: reps === null ? '' : String(reps), rpe: '', notes: '' };
}

function Info({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={cn('rounded-xl p-2.5', highlight ? 'bg-accent-soft' : 'bg-surface-2')}>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className={cn('tabular mt-0.5 text-sm font-semibold', highlight && 'text-accent-ink')}>{value}</dd>
      {sub && <dd className="text-[10px] text-subtle">{sub}</dd>}
    </div>
  );
}

function Stepper({ label, value, onChange, step, decimal }: { label: string; value: string; onChange: (v: string) => void; step: number; decimal?: boolean }) {
  const n = Number(value.replace(',', '.')) || 0;
  const fmt = (x: number) => String(Math.max(0, Math.round(x * 100) / 100));
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="flex h-11 items-center overflow-hidden rounded-xl border border-border bg-surface-2 focus-within:border-accent/70">
        <button type="button" className="h-full w-8 shrink-0 text-lg text-muted hover:text-fg" onClick={() => onChange(fmt(n - step))} aria-label={`Diminuir ${label}`}>
          −
        </button>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={decimal ? 'decimal' : 'numeric'}
          className="tabular h-full w-full min-w-0 bg-transparent text-center text-base font-semibold outline-none"
          aria-label={label}
        />
        <button type="button" className="h-full w-8 shrink-0 text-lg text-muted hover:text-fg" onClick={() => onChange(fmt(n + step))} aria-label={`Aumentar ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}

function Elapsed({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  return (
    <span className="tabular inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold">
      <Clock className="size-3.5 text-accent-ink" /> {formatDuration(secs)}
    </span>
  );
}

function RestOverlay({ rest, nextName, onAdd, onDone }: { rest: { endsAt: number; total: number }; nextName?: string; onAdd: () => void; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Math.ceil((rest.endsAt - now) / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (remaining === 0) {
      navigator.vibrate?.(300);
      onDone();
    }
  }, [remaining, onDone]);
  const r = 88;
  const c = 2 * Math.PI * r;
  const pct = rest.total ? remaining / rest.total : 0;
  return (
    <div className="animate-fade fixed inset-0 z-[90] flex flex-col items-center justify-center bg-bg/95 px-6 backdrop-blur" role="dialog" aria-label="Descanso">
      <p className="text-sm font-semibold tracking-wider text-muted uppercase">
        <Timer className="mr-1.5 inline size-4" />
        Descanso: {rest.total} segundos
      </p>
      <div className="relative mt-6">
        <svg viewBox="0 0 200 200" className="size-56 -rotate-90">
          <circle cx="100" cy="100" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
          <circle cx="100" cy="100" r={r} fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - pct * c} style={{ transition: 'stroke-dashoffset 0.25s linear' }} />
        </svg>
        <span className="tabular absolute inset-0 grid place-items-center text-6xl font-semibold tracking-tight">{remaining}</span>
      </div>
      {nextName && (
        <p className="mt-6 text-sm text-muted">
          Próximo: <span className="font-medium text-fg">{nextName}</span>
        </p>
      )}
      <div className="mt-8 flex w-full max-w-sm gap-2">
        <Button variant="secondary" size="lg" className="flex-1" onClick={onAdd}>
          <Plus className="size-4" /> 15s
        </Button>
        <Button size="lg" className="flex-[2] tracking-wide" onClick={onDone}>
          <SkipForward className="size-5" /> PULAR DESCANSO
        </Button>
      </div>
    </div>
  );
}

function FinishModal({ open, loading, pending, onClose, onConfirm }: { open: boolean; loading: boolean; pending: number; onClose: () => void; onConfirm: (b: { perceivedEffort?: number; notes?: string }) => void }) {
  const [effort, setEffort] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Finalizar treino"
      description={pending > 0 ? `Ainda faltam ${pending} série(s). Deseja finalizar mesmo assim?` : 'Ótimo trabalho! Como foi o treino?'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Continuar treinando
          </Button>
          <Button loading={loading} onClick={() => onConfirm({ perceivedEffort: effort ?? undefined, notes: notes.trim() || undefined })}>
            Finalizar
          </Button>
        </>
      }
    >
      <p className="mb-2 text-xs font-medium text-muted">Percepção de esforço (PSE)</p>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setEffort(n)}
            className={cn('tabular h-10 rounded-lg border text-sm font-semibold transition', effort === n ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-surface-2 text-muted hover:text-fg')}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="mt-1.5 flex justify-between text-[11px] text-subtle">
        <span>Muito leve</span>
        <span>Máximo</span>
      </p>
      <Textarea label="Como você se sentiu?" value={notes} onChange={(e) => setNotes(e.target.value)} wrapperClassName="mt-4" className="min-h-16" />
    </Modal>
  );
}

function Summary({ summary: s, name }: { summary: FinishSessionResponse['summary']; name: string }) {
  return (
    <div className="mx-auto max-w-xl py-4 text-center">
      <span className="mx-auto grid size-20 place-items-center rounded-3xl bg-accent text-accent-fg">
        <Trophy className="size-10" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Treino concluído!</h1>
      <p className="mt-1 text-sm text-muted">
        {name} · seu {s.totalWorkouts}º treino 🎉
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 text-left sm:grid-cols-3">
        <SummaryStat icon={<Clock />} label="Duração" value={formatDuration(s.durationSeconds)} />
        <SummaryStat icon={<Dumbbell />} label="Volume total" value={`${fmtNumber(s.totalVolumeKg, 0)} kg`} />
        <SummaryStat icon={<Flame />} label="Calorias" value={s.estimatedCalories ? `~${fmtNumber(s.estimatedCalories, 0)} kcal` : '—'} />
        <SummaryStat icon={<Check />} label="Séries" value={String(s.setsCount)} />
        <SummaryStat icon={<Dumbbell />} label="Exercícios" value={String(s.exercisesCount)} />
        <SummaryStat icon={<Trophy />} label="Recordes" value={String(s.personalRecords.length)} />
      </div>
      <p className="mt-3 text-xs text-subtle">
        Início {new Date(s.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · fim {new Date(s.finishedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </p>
      {s.personalRecords.length > 0 && (
        <Card className="mt-5 p-4 text-left">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Trophy className="size-4 text-accent-ink" /> Novos recordes pessoais
          </p>
          <ul className="space-y-1 text-sm">
            {s.personalRecords.map((r, i) => (
              <li key={i} className="flex justify-between">
                <span className="text-muted">{r.exercise}</span>
                <span className="tabular font-semibold">
                  {fmtNumber(r.loadKg)} kg × {r.reps}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <LinkButton href="/aluno" size="lg">
          Voltar ao início
        </LinkButton>
        <LinkButton href="/aluno/evolucao" size="lg" variant="secondary">
          Ver minha evolução
        </LinkButton>
      </div>
    </div>
  );
}

function SummaryStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4">
      <span className="text-accent-ink [&>svg]:size-4">{icon}</span>
      <p className="mt-2 text-xs text-muted">{label}</p>
      <p className="tabular text-lg font-semibold">{value}</p>
    </Card>
  );
}
