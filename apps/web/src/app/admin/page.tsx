'use client';

import { formatCurrency, type AdminMetrics, type SubscriptionStatus } from '@personalpro/shared';
import { useQuery } from '@tanstack/react-query';
import { Activity, CircleDollarSign, Dumbbell, GraduationCap, TrendingUp, UserPlus, Users } from 'lucide-react';
import { BarsChart } from '@/components/charts';
import { Card, CardBody, CardHeader, ErrorState, PageHeader, ProgressBar, Skeleton, StatCard } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDayKey, fmtMonthKey } from '@/lib/format';

const SUB_STATUS_LABELS: Record<SubscriptionStatus, string> = { TRIALING: 'Em teste', ACTIVE: 'Ativas', PAST_DUE: 'Inadimplentes', CANCELED: 'Canceladas' };

export default function AdminOverviewPage() {
  const q = useQuery({ queryKey: ['admin-metrics'], queryFn: () => api<AdminMetrics>('/admin/metrics') });
  const m = q.data;
  return (
    <div>
      <PageHeader title="Visão geral" subtitle="Indicadores da plataforma nos últimos 30 dias" />
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.isLoading && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}
      {m && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Professores" value={m.totals.trainers} icon={<Users className="size-4" />} tone="accent" />
            <StatCard label="Alunos" value={m.totals.students} icon={<GraduationCap className="size-4" />} tone="info" />
            <StatCard label="Usuários ativos (30d)" value={m.totals.activeUsers30d} icon={<Activity className="size-4" />} />
            <StatCard label="Novos cadastros (30d)" value={m.totals.newSignups30d} icon={<UserPlus className="size-4" />} />
            <StatCard label="Treinos realizados (30d)" value={m.totals.workouts30d} icon={<Dumbbell className="size-4" />} />
            <StatCard label="MRR" value={formatCurrency(m.revenue.mrrCents)} icon={<TrendingUp className="size-4" />} tone="accent" hint="Receita recorrente mensal" />
            <StatCard label="Faturamento (30d)" value={formatCurrency(m.revenue.last30dCents)} icon={<CircleDollarSign className="size-4" />} tone="warning" />
            <StatCard
              label="Assinaturas ativas"
              value={(m.subscriptions.byStatus.ACTIVE ?? 0) + (m.subscriptions.byStatus.TRIALING ?? 0)}
              icon={<CircleDollarSign className="size-4" />}
              hint={`${m.subscriptions.byStatus.PAST_DUE ?? 0} inadimplentes`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Cadastros por dia" subtitle="Professores e alunos — últimos 30 dias" />
              <CardBody>
                <BarsChart
                  stacked
                  data={m.series.signups}
                  xKey="date"
                  series={[
                    { key: 'trainers', label: 'Professores' },
                    { key: 'students', label: 'Alunos' },
                  ]}
                  xFormatter={fmtDayKey}
                  empty="Nenhum cadastro no período"
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Treinos por dia" subtitle="Sessões concluídas — últimos 30 dias" />
              <CardBody>
                <BarsChart data={m.series.workouts} xKey="date" series={[{ key: 'count', label: 'Treinos' }]} xFormatter={fmtDayKey} empty="Nenhum treino no período" />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Faturamento mensal" subtitle="Pagamentos confirmados — 12 meses" />
              <CardBody>
                <BarsChart
                  data={m.revenue.monthly.map((r) => ({ month: r.month, value: r.amountCents / 100 }))}
                  xKey="month"
                  series={[{ key: 'value', label: 'Faturamento' }]}
                  xFormatter={fmtMonthKey}
                  yFormatter={(v) => `R$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                  valueFormatter={(v) => formatCurrency(Math.round(v * 100))}
                  empty="Nenhum pagamento registrado nos últimos 12 meses"
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Assinaturas" subtitle="Por status e ativas por plano" />
              <CardBody className="grid gap-6 sm:grid-cols-2">
                <Breakdown title="Por status" data={Object.entries(m.subscriptions.byStatus).map(([k, v]) => [SUB_STATUS_LABELS[k as SubscriptionStatus] ?? k, v ?? 0])} />
                <Breakdown title="Ativas por plano" data={Object.entries(m.subscriptions.activeByPlan)} />
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: [string, number][] }) {
  const total = data.reduce((a, [, v]) => a + v, 0);
  return (
    <div>
      <p className="mb-3 text-xs font-medium text-muted">{title}</p>
      {data.length === 0 ? (
        <p className="text-sm text-subtle">Sem dados</p>
      ) : (
        <ul className="space-y-3">
          {data.map(([label, v]) => (
            <li key={label}>
              <div className="flex justify-between text-sm">
                <span>{label}</span>
                <span className="tabular font-semibold">{v}</span>
              </div>
              <ProgressBar value={total ? (v / total) * 100 : 0} className="mt-1 h-1.5" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
