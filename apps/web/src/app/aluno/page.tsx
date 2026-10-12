'use client';

import { APPOINTMENT_STATUS_LABELS, formatDuration, type StudentDashboard } from '@personalpro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, ChevronRight, Dumbbell, Flame, HelpCircle, LineChart, MessageCircle, Play, Scale, Send, Target, Trophy, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DeltaPill } from '@/components/evolution-panel';
import { useToast } from '@/components/toast';
import { Avatar, Badge, Button, Card, CardBody, CardHeader, ErrorState, Input, LinkButton, ProgressBar, Skeleton, Textarea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { appointmentTone, fmtDateTime, fmtNumber, fmtWeekdayLong, relativeDays } from '@/lib/format';

export default function StudentHomePage() {
  const q = useQuery({ queryKey: ['dashboard-student'], queryFn: () => api<StudentDashboard>('/dashboard/student') });
  const d = q.data;

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!d)
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-52" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );

  const tw = d.todayWorkout;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted">{fmtWeekdayLong(new Date())}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">Olá, {d.greetingName}! 💪</h1>
      </div>

      {!d.trainer && <LinkTrainerCard />}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full opacity-20 blur-3xl" style={{ background: 'var(--accent)' }} />
          <div className="relative p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Badge tone={tw?.completedToday ? 'success' : 'accent'}>
                {tw?.completedToday ? (
                  <>
                    <CheckCircle2 className="size-3" /> Concluído hoje
                  </>
                ) : tw?.scheduledForToday ? (
                  'Treino de hoje'
                ) : (
                  'Próximo treino'
                )}
              </Badge>
            </div>
            {tw ? (
              <>
                <div className="mt-4 flex items-center gap-4">
                  <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-accent text-3xl font-bold text-accent-fg">{tw.label ?? <Dumbbell className="size-7" />}</span>
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{tw.name}</h2>
                    <p className="text-sm text-muted">{tw.exercisesCount} exercícios</p>
                  </div>
                </div>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  <LinkButton href={`/aluno/treinos/${tw.id}/executar`} size="lg" className="w-full tracking-wide">
                    <Play className="size-5 fill-current" /> {tw.completedToday ? 'TREINAR DE NOVO' : 'INICIAR TREINO'}
                  </LinkButton>
                  <LinkButton href={`/aluno/treinos/${tw.id}`} size="lg" variant="secondary" className="w-full tracking-wide">
                    <Dumbbell className="size-5" /> MEU TREINO
                  </LinkButton>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-muted">{d.trainer ? 'Seu personal ainda não atribuiu treinos para você.' : 'Vincule-se a um personal para receber seus treinos.'}</p>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          <QuickAction href="/aluno/evolucao" icon={<LineChart />} label="MINHA EVOLUÇÃO" />
          <QuickAction href="/aluno/agenda" icon={<CalendarDays />} label="AGENDA" />
          <QuickAction href="/aluno/mensagens" icon={<MessageCircle />} label="FALAR COM PERSONAL" disabled={!d.trainer} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="col-span-2 p-4 sm:p-5 lg:col-span-1">
          <p className="text-xs font-medium text-muted">Progresso da semana</p>
          <div className="mt-2 flex items-center gap-4">
            <Ring pct={d.weekProgress.pct} />
            <div>
              <p className="tabular text-2xl font-semibold">
                {d.weekProgress.done}
                <span className="text-base text-muted">/{d.weekProgress.planned}</span>
              </p>
              <p className="text-xs text-muted">treinos feitos</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 sm:p-5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Scale className="size-3.5" /> Peso atual
          </p>
          <p className="tabular mt-2 text-2xl font-semibold">{d.weight.currentKg ? `${fmtNumber(d.weight.currentKg)} kg` : '—'}</p>
          <div className="mt-1">
            <DeltaPill evo={d.weight.evolution} unit="kg" lowerIsBetter />
          </div>
        </Card>
        <Card className="p-4 sm:p-5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Trophy className="size-3.5" /> Treinos realizados
          </p>
          <p className="tabular mt-2 text-2xl font-semibold">{d.totalWorkouts}</p>
          <p className="mt-1 text-xs text-muted">
            {d.stats.monthCount} no mês · {d.stats.currentStreakDays > 0 && <Flame className="inline size-3 text-warning" />}
            {d.stats.currentStreakDays > 0 ? ` ${d.stats.currentStreakDays} dias seguidos` : `média ${d.stats.averageDurationSeconds ? formatDuration(d.stats.averageDurationSeconds) : '—'}`}
          </p>
        </Card>
        <Card className="col-span-2 p-4 sm:p-5 lg:col-span-1">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <CalendarDays className="size-3.5" /> Próxima sessão
          </p>
          {d.nextAppointment ? (
            <>
              <p className="mt-2 font-semibold">{fmtDateTime(d.nextAppointment.startsAt)}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                com {d.nextAppointment.trainerName}
                <Badge tone={appointmentTone(d.nextAppointment.status)}>{APPOINTMENT_STATUS_LABELS[d.nextAppointment.status]}</Badge>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Nenhuma sessão.{' '}
              <Link href="/aluno/agenda" className="font-medium text-accent-ink">
                Agendar
              </Link>
            </p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Meta principal"
            subtitle={d.goalsCount > 1 ? `+${d.goalsCount - 1} outra(s) meta(s)` : undefined}
            icon={<Target className="size-4" />}
            action={
              <Link href="/aluno/evolucao#metas" className="flex items-center text-xs font-medium text-muted hover:text-fg">
                Ver metas <ChevronRight className="size-3.5" />
              </Link>
            }
          />
          <CardBody>
            {d.mainGoal ? (
              <>
                <p className="font-semibold">{d.mainGoal.title}</p>
                <div className="mt-3 flex items-end justify-between">
                  <p className="tabular text-sm text-muted">
                    <span className="text-xl font-semibold text-fg">{fmtNumber(d.mainGoal.currentValue)}</span> / {fmtNumber(d.mainGoal.targetValue)} {d.mainGoal.unit}
                  </p>
                  <p className="tabular font-semibold text-accent-ink">{Math.round(d.mainGoal.progressPct)}%</p>
                </div>
                <ProgressBar value={d.mainGoal.progressPct} className="mt-2 h-2.5" />
              </>
            ) : (
              <p className="text-sm text-muted">Seu personal ainda não definiu metas.</p>
            )}
            {d.lastWorkout && <p className="mt-4 border-t border-border pt-3 text-xs text-muted">Último treino: {d.lastWorkout.name ?? 'Treino'} · {relativeDays(d.lastWorkout.startedAt)}</p>}
          </CardBody>
        </Card>

        {d.trainer && <QuestionCard trainer={d.trainer} />}
      </div>
    </div>
  );
}

function QuickAction({ href, icon, label, disabled }: { href: string; icon: React.ReactNode; label: string; disabled?: boolean }) {
  return (
    <Link
      href={disabled ? '#' : href}
      aria-disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-3 text-center text-[11px] font-semibold tracking-wide transition hover:border-border-strong sm:text-xs lg:flex-row lg:justify-start lg:gap-3 lg:p-4',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-ink [&>svg]:size-5">{icon}</span>
      {label}
      <ChevronRight className="ml-auto hidden size-4 text-subtle lg:block" />
    </Link>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct));
  return (
    <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} />
      <text x="32" y="32" textAnchor="middle" dominantBaseline="central" className="rotate-90 fill-[var(--fg)] text-[13px] font-semibold" style={{ transformOrigin: '32px 32px' }}>
        {Math.round(v)}%
      </text>
    </svg>
  );
}

function QuestionCard({ trainer }: { trainer: NonNullable<StudentDashboard['trainer']> }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const send = useMutation({
    mutationFn: () => api('/conversations/question', { method: 'POST', body: { content: content.trim() } }),
    onSuccess: () => {
      setContent('');
      toast.success('Dúvida enviada!', `${trainer.name.split(' ')[0]} vai responder pelo chat.`);
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e) => toast.error('Não foi possível enviar', errorMessage(e)),
  });
  return (
    <Card>
      <CardHeader title="Enviar dúvida ao professor" icon={<HelpCircle className="size-4" />} />
      <CardBody>
        <div className="mb-3 flex items-center gap-3">
          <Avatar name={trainer.name} src={trainer.avatarUrl} size={36} />
          <div>
            <p className="text-sm font-medium">{trainer.name}</p>
            <p className="text-xs text-muted">Seu personal</p>
          </div>
        </div>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Ex.: Posso trocar o leg press pelo agachamento hoje?" className="min-h-20" />
        <div className="mt-3 flex justify-end">
          <Button loading={send.isPending} disabled={!content.trim()} onClick={() => send.mutate()}>
            <Send className="size-4" /> Enviar dúvida
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function LinkTrainerCard() {
  const toast = useToast();
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const accept = useMutation({
    mutationFn: () => api('/invites/accept', { method: 'POST', body: { code: code.trim().toUpperCase() } }),
    onSuccess: () => {
      toast.success('Vínculo criado!', 'Agora você receberá os treinos do seu personal.');
      qc.invalidateQueries();
    },
    onError: (e) => toast.error('Código inválido', errorMessage(e)),
  });
  return (
    <Card className="border-accent/40 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
          <UserPlus className="size-6" />
        </span>
        <div className="flex-1">
          <p className="font-semibold">Vincule-se ao seu personal</p>
          <p className="text-sm text-muted">Informe o código do professor para receber treinos, metas e conversar pelo chat.</p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            accept.mutate();
          }}
        >
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CÓDIGO" className="w-32 font-mono uppercase" aria-label="Código do professor" />
          <Button type="submit" className="h-11" loading={accept.isPending} disabled={!code.trim()}>
            Vincular
          </Button>
        </form>
      </div>
    </Card>
  );
}
