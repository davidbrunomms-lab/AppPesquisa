'use client';

import { APPOINTMENT_STATUS_LABELS, formatDuration, type TrainerDashboard } from '@personalpro/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlarmClock,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  Dumbbell,
  MessageCircle,
  Percent,
  Plus,
  Sparkles,
  Target,
  TrendingDown,
  UserPlus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Avatar, Badge, Card, CardBody, CardHeader, ErrorState, LinkButton, ProgressBar, Skeleton, StatCard } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { appointmentTone, firstName, fmtDate, fmtDateTime, fmtSigned, fmtTime, fmtWeekdayLong } from '@/lib/format';

const STATUS_SUB: Record<string, string> = { TRIALING: 'Período de teste', ACTIVE: 'Ativa', PAST_DUE: 'Pagamento pendente', CANCELED: 'Cancelada' };

export default function TrainerDashboardPage() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['dashboard-trainer'], queryFn: () => api<TrainerDashboard>('/dashboard/trainer') });
  const d = q.data;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">{fmtWeekdayLong(new Date())}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">Olá, {firstName(user?.name)} 👋</h1>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/professor/treinos/novo" variant="secondary">
            <Plus className="size-4" /> Novo treino
          </LinkButton>
          <LinkButton href="/professor/alunos?novo=1">
            <UserPlus className="size-4" /> Adicionar aluno
          </LinkButton>
        </div>
      </div>

      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.isLoading && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Alunos ativos"
              value={d.activeStudents}
              icon={<Users className="size-4" />}
              tone="accent"
              href="/professor/alunos"
              hint={d.newStudents.length ? `+${d.newStudents.length} novos nos últimos 30 dias` : d.inactiveLinks ? `${d.inactiveLinks} inativos` : 'Nenhum novo aluno recente'}
            />
            <StatCard label="Treinos hoje" value={d.workoutsToday.count} icon={<Dumbbell className="size-4" />} tone="info" hint={`${d.overallEvolution.workoutsThisMonth} no mês`} />
            <StatCard
              label="Taxa de frequência"
              value={`${Math.round(d.attendanceRate)}%`}
              icon={<Percent className="size-4" />}
              tone={d.attendanceRate >= 70 ? 'accent' : d.attendanceRate >= 40 ? 'warning' : 'danger'}
              hint={<ProgressBar value={d.attendanceRate} className="mt-1.5 h-1.5" />}
            />
            <StatCard
              label="Avaliações pendentes"
              value={d.pendingAssessments.overdueScheduled.length + d.pendingAssessments.studentsDue.length}
              icon={<ClipboardCheck className="size-4" />}
              tone="warning"
              hint={`${d.upcomingAssessments.length} agendadas`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Agenda de hoje"
                subtitle={`${d.agendaToday.length} compromisso(s)`}
                icon={<CalendarDays className="size-4" />}
                action={<SeeAll href="/professor/agenda" />}
              />
              <CardBody>
                {d.agendaToday.length === 0 ? (
                  <Empty>Nenhum compromisso para hoje.</Empty>
                ) : (
                  <ul className="divide-y divide-border">
                    {d.agendaToday.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 py-2.5">
                        <div className="w-14 shrink-0 text-center">
                          <p className="tabular text-sm font-semibold">{fmtTime(a.startsAt)}</p>
                          <p className="tabular text-[11px] text-subtle">{fmtTime(a.endsAt)}</p>
                        </div>
                        {a.student ? <Avatar name={a.student.name} src={a.student.avatarUrl} size={32} /> : <span className="size-8 rounded-full border border-dashed border-border-strong" />}
                        <p className="min-w-0 flex-1 truncate text-sm">{a.student?.name ?? 'Horário livre'}</p>
                        <Badge tone={appointmentTone(a.status)}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Plano e uso" icon={<CreditCard className="size-4" />} action={<SeeAll href="/professor/perfil#assinatura" label="Gerenciar" />} />
              <CardBody>
                {d.subscription ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{d.subscription.plan}</p>
                      <Badge tone={d.subscription.status === 'ACTIVE' ? 'success' : d.subscription.status === 'TRIALING' ? 'info' : 'warning'}>{STATUS_SUB[d.subscription.status]}</Badge>
                    </div>
                    <p className="mt-4 text-sm text-muted">
                      <span className="tabular text-2xl font-semibold text-fg">{d.subscription.usedSeats}</span> / {d.subscription.maxStudents ?? '∞'} alunos
                    </p>
                    <ProgressBar className="mt-2" value={d.subscription.maxStudents ? (d.subscription.usedSeats / d.subscription.maxStudents) * 100 : 8} />
                    <p className="mt-3 text-xs text-muted">Renova em {fmtDate(d.subscription.currentPeriodEnd)}</p>
                  </>
                ) : (
                  <div className="text-sm text-muted">
                    Nenhuma assinatura ativa.{' '}
                    <Link href="/professor/perfil#assinatura" className="font-medium text-accent-ink hover:underline">
                      Escolher plano
                    </Link>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader title="Sem treinar recentemente" subtitle="Alunos que precisam de atenção" icon={<AlarmClock className="size-4" />} action={<SeeAll href="/professor/alunos?inativos=7" />} />
              <CardBody>
                {d.studentsWithoutTraining.length === 0 ? (
                  <Empty>Todos os alunos estão em dia. 🎉</Empty>
                ) : (
                  <ul className="space-y-1">
                    {d.studentsWithoutTraining.slice(0, 6).map((s) => (
                      <PersonRow key={s.id} id={s.id} name={s.name} avatarUrl={s.avatarUrl}>
                        <Badge tone={s.daysWithoutTraining === null || s.daysWithoutTraining >= 7 ? 'danger' : 'warning'}>
                          {s.daysWithoutTraining === null ? 'Nunca treinou' : `${s.daysWithoutTraining} dias`}
                        </Badge>
                      </PersonRow>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Treinos realizados hoje" icon={<Dumbbell className="size-4" />} />
              <CardBody>
                {d.workoutsToday.items.length === 0 ? (
                  <Empty>Nenhum treino registrado hoje ainda.</Empty>
                ) : (
                  <ul className="space-y-1">
                    {d.workoutsToday.items.map((w) => (
                      <PersonRow key={w.sessionId} id={w.student.id} name={w.student.name} avatarUrl={w.student.avatarUrl} sub={w.workout ?? 'Treino livre'}>
                        <span className="tabular text-xs text-muted">{w.durationSeconds ? formatDuration(w.durationSeconds) : `${fmtTime(w.startedAt)} · em andamento`}</span>
                      </PersonRow>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Avaliações" subtitle="Atrasadas, próximas e alunos sem avaliação recente" icon={<ClipboardCheck className="size-4" />} />
              <CardBody>
                {d.pendingAssessments.overdueScheduled.length + d.upcomingAssessments.length + d.pendingAssessments.studentsDue.length === 0 ? (
                  <Empty>Nada pendente.</Empty>
                ) : (
                  <ul className="space-y-1">
                    {d.pendingAssessments.overdueScheduled.map((a) => (
                      <PersonRow key={a.id} id={a.student.id} name={a.student.name} avatarUrl={a.student.avatarUrl} sub={`Agendada ${fmtDateTime(a.scheduledFor)}`} tab="avaliacoes">
                        <Badge tone="danger">Atrasada</Badge>
                      </PersonRow>
                    ))}
                    {d.upcomingAssessments.map((a) => (
                      <PersonRow key={a.id} id={a.student.id} name={a.student.name} avatarUrl={a.student.avatarUrl} sub={fmtDateTime(a.scheduledFor)} tab="avaliacoes">
                        <Badge tone="info">Agendada</Badge>
                      </PersonRow>
                    ))}
                    {d.pendingAssessments.studentsDue.map((s) => (
                      <PersonRow key={s.id} id={s.id} name={s.name} avatarUrl={s.avatarUrl} sub="Reavaliação recomendada" tab="avaliacoes">
                        <Badge tone="warning">Pendente</Badge>
                      </PersonRow>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Evolução geral" icon={<Activity className="size-4" />} />
              <CardBody className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-surface-2 p-3">
                  <p className="text-xs text-muted">Variação média de peso</p>
                  <p className="tabular mt-1 flex items-center gap-1 text-xl font-semibold">
                    {d.overallEvolution.averageWeightDeltaKg !== null && d.overallEvolution.averageWeightDeltaKg < 0 && <TrendingDown className="size-4 text-success" />}
                    {fmtSigned(d.overallEvolution.averageWeightDeltaKg, 'kg')}
                  </p>
                  <p className="text-[11px] text-subtle">{d.overallEvolution.studentsWithWeightData} alunos com dados</p>
                </div>
                <div className="rounded-xl bg-surface-2 p-3">
                  <p className="text-xs text-muted">Treinos no mês</p>
                  <p className="tabular mt-1 text-xl font-semibold">{d.overallEvolution.workoutsThisMonth}</p>
                  <p className="text-[11px] text-subtle">todos os alunos</p>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Metas próximas de serem atingidas" icon={<Target className="size-4" />} />
              <CardBody>
                {d.goalsNearCompletion.length === 0 ? (
                  <Empty>Nenhuma meta acima de 80% ainda.</Empty>
                ) : (
                  <ul className="space-y-3">
                    {d.goalsNearCompletion.map((g) => (
                      <li key={g.id}>
                        <Link href={`/professor/alunos/${g.student.id}#metas`} className="block">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate">
                              <span className="font-medium">{firstName(g.student.name)}</span> <span className="text-muted">· {g.title}</span>
                            </span>
                            <span className="tabular font-semibold text-accent-ink">{Math.round(g.progressPct)}%</span>
                          </div>
                          <ProgressBar value={g.progressPct} className="mt-1.5 h-1.5" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <div className="grid grid-cols-2 gap-3 md:col-span-2 xl:col-span-1 xl:grid-cols-1">
              <StatCard label="Sugestões da IA pendentes" value={d.pendingAiSuggestions} icon={<Sparkles className="size-4" />} tone="info" href="/professor/ia" hint="Aguardando sua aprovação" />
              <StatCard label="Mensagens não lidas" value={d.unreadMessages} icon={<MessageCircle className="size-4" />} tone={d.unreadMessages ? 'accent' : 'default'} href="/professor/mensagens" hint="Responder alunos" />
            </div>
          </div>

          {d.newStudents.length > 0 && (
            <Card>
              <CardHeader title="Novos alunos" subtitle="Últimos 30 dias" icon={<UserPlus className="size-4" />} />
              <CardBody className="flex flex-wrap gap-2">
                {d.newStudents.map((s) => (
                  <Link key={s.id} href={`/professor/alunos/${s.id}`} className="flex items-center gap-2 rounded-full border border-border bg-surface-2 py-1 pr-3 pl-1 text-sm hover:border-border-strong">
                    <Avatar name={s.name} src={s.avatarUrl} size={26} />
                    {s.name}
                  </Link>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function SeeAll({ href, label = 'Ver tudo' }: { href: string; label?: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted hover:text-fg">
      {label} <ChevronRight className="size-3.5" />
    </Link>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-4 text-center text-sm text-muted">{children}</p>;
}

function PersonRow({ id, name, avatarUrl, sub, children, tab }: { id: string; name: string; avatarUrl?: string | null; sub?: string; children?: ReactNode; tab?: string }) {
  return (
    <li>
      <Link href={`/professor/alunos/${id}${tab ? `#${tab}` : ''}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
        <Avatar name={name} src={avatarUrl} size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          {sub && <p className="truncate text-xs text-muted">{sub}</p>}
        </div>
        {children}
      </Link>
    </li>
  );
}

