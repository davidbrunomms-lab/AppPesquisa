'use client';

import { formatCurrency, type MySubscription, type Plan } from '@personalpro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CreditCard, Crown } from 'lucide-react';
import { useToast } from './toast';
import { Badge, Button, Card, CardBody, CardHeader, ErrorState, LoadingBlock, ProgressBar } from './ui';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate } from '@/lib/format';

const STATUS: Record<string, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' }> = {
  TRIALING: { label: 'Período de teste', tone: 'info' },
  ACTIVE: { label: 'Ativa', tone: 'success' },
  PAST_DUE: { label: 'Pagamento pendente', tone: 'warning' },
  CANCELED: { label: 'Cancelada', tone: 'danger' },
};
const PAYMENT_STATUS: Record<string, string> = { PAID: 'Pago', PENDING: 'Pendente', FAILED: 'Falhou', REFUNDED: 'Estornado' };

export function SubscriptionCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const me = useQuery({ queryKey: ['subscription-me'], queryFn: () => api<MySubscription>('/subscriptions/me') });
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api<Plan[]>('/plans', { auth: false }) });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['subscription-me'] });
    qc.invalidateQueries({ queryKey: ['dashboard-trainer'] });
  };
  const checkout = useMutation({
    mutationFn: (planCode: string) => api<{ checkoutUrl: string | null }>('/subscriptions/checkout', { method: 'POST', body: { planCode } }),
    onSuccess: (r) => {
      if (r.checkoutUrl) {
        window.location.href = r.checkoutUrl;
        return;
      }
      toast.success('Plano atualizado', 'Sua assinatura foi ativada.');
      invalidate();
    },
    onError: (e) => toast.error('Não foi possível contratar', errorMessage(e)),
  });
  const cancel = useMutation({
    mutationFn: () => api('/subscriptions/cancel', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Cancelamento agendado', 'Você mantém o acesso até o fim do período pago.');
      invalidate();
    },
    onError: (e) => toast.error('Erro ao cancelar', errorMessage(e)),
  });

  if (me.isLoading || plans.isLoading) return <LoadingBlock />;
  if (me.isError) return <ErrorState error={me.error} />;
  const sub = me.data!.subscription;
  const usage = me.data!.usage;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Sua assinatura" icon={<CreditCard className="size-4" />} />
        <CardBody>
          {sub ? (
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold">{sub.plan.name}</p>
                  <Badge tone={STATUS[sub.status]?.tone ?? 'info'}>{STATUS[sub.status]?.label ?? sub.status}</Badge>
                  {sub.cancelAtPeriodEnd && <Badge tone="warning">Cancela em {fmtDate(sub.currentPeriodEnd)}</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatCurrency(sub.plan.priceCents, sub.plan.currency)}/{sub.plan.interval === 'YEARLY' ? 'ano' : 'mês'} · {sub.cancelAtPeriodEnd ? 'acesso até' : 'renova em'} {fmtDate(sub.currentPeriodEnd)}
                </p>
                {!me.data!.entitled && <p className="mt-2 text-sm text-warning">Assinatura inativa — regularize para adicionar alunos.</p>}
              </div>
              <div>
                <p className="text-sm text-muted">
                  <span className="tabular text-xl font-semibold text-fg">{usage.students}</span> / {usage.maxStudents ?? '∞'} alunos ativos
                </p>
                <ProgressBar className="mt-2" value={usage.maxStudents ? (usage.students / usage.maxStudents) * 100 : 5} tone={usage.maxStudents && usage.students >= usage.maxStudents ? 'warning' : 'accent'} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Você ainda não possui assinatura. Escolha um plano abaixo para começar.</p>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        {(plans.data ?? [])
          .filter((p) => p.active)
          .map((p) => {
            const current = sub?.plan.id === p.id && sub.status !== 'CANCELED';
            const popular = p.code === 'PERSONAL_PRO';
            return (
              <Card key={p.id} className={cn('relative flex flex-col p-5', current && 'border-accent', popular && !current && 'border-border-strong')}>
                {popular && (
                  <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-accent-fg">
                    <Crown className="size-3" /> Mais escolhido
                  </span>
                )}
                <p className="font-semibold">{p.name}</p>
                <p className="mt-1 text-sm text-muted">{p.description}</p>
                <p className="mt-4">
                  <span className="tabular text-3xl font-semibold tracking-tight">{formatCurrency(p.priceCents, p.currency)}</span>
                  <span className="text-sm text-muted">/{p.interval === 'YEARLY' ? 'ano' : 'mês'}</span>
                </p>
                <ul className="mt-4 mb-5 space-y-1.5 text-sm text-muted">
                  <li className="flex gap-2">
                    <Check className="size-4 text-accent-ink" /> {p.maxStudents ? `Até ${p.maxStudents} alunos` : 'Alunos ilimitados'}
                  </li>
                  <li className="flex gap-2">
                    <Check className="size-4 text-accent-ink" /> Treinos, avaliações e chat
                  </li>
                  <li className="flex gap-2">
                    <Check className="size-4 text-accent-ink" /> Assistente de IA
                  </li>
                </ul>
                <Button className="mt-auto" variant={current ? 'secondary' : 'primary'} disabled={current} loading={checkout.isPending && checkout.variables === p.code} onClick={() => checkout.mutate(p.code)}>
                  {current ? 'Plano atual' : sub ? 'Mudar para este plano' : 'Assinar'}
                </Button>
              </Card>
            );
          })}
      </div>

      {sub && (
        <Card>
          <CardHeader title="Pagamentos" />
          <CardBody>
            {sub.payments.length === 0 ? (
              <p className="text-sm text-muted">Nenhum pagamento registrado.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {sub.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <span className="text-muted">{fmtDate(p.paidAt ?? p.createdAt)}</span>
                    <span className="tabular font-medium">{formatCurrency(p.amountCents)}</span>
                    <Badge tone={p.status === 'PAID' ? 'success' : 'warning'}>{PAYMENT_STATUS[p.status] ?? p.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {!sub.cancelAtPeriodEnd && sub.status !== 'CANCELED' && (
              <Button variant="ghost" className="mt-3 text-danger" loading={cancel.isPending} onClick={() => confirm('Cancelar a assinatura ao fim do período atual?') && cancel.mutate()}>
                Cancelar assinatura
              </Button>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
