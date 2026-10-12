'use client';

import { formatCurrency, type Plan, type SubscriptionStatus } from '@personalpro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Receipt } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingBlock, Modal, PageHeader, Segmented } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { fmtDate } from '@/lib/format';

interface AdminSubscription {
  id: string;
  status: SubscriptionStatus;
  provider: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan: Plan;
  trainer: { id: string; cref: string | null; user: { name: string; email: string }; _count: { students: number } };
  payments: { id: string; amountCents: number; status: string; paidAt: string | null; createdAt: string }[];
}

const STATUS: Record<SubscriptionStatus, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' }> = {
  TRIALING: { label: 'Em teste', tone: 'info' },
  ACTIVE: { label: 'Ativa', tone: 'success' },
  PAST_DUE: { label: 'Inadimplente', tone: 'warning' },
  CANCELED: { label: 'Cancelada', tone: 'danger' },
};

export default function AdminSubscriptionsPage() {
  const [status, setStatus] = useState<SubscriptionStatus | 'ALL'>('ALL');
  const [payFor, setPayFor] = useState<AdminSubscription | null>(null);
  const q = useQuery({
    queryKey: ['admin-subscriptions', status],
    queryFn: () => api<AdminSubscription[]>('/admin/subscriptions', { query: { status: status === 'ALL' ? undefined : status } }),
  });

  return (
    <div>
      <PageHeader title="Assinaturas" subtitle="Assinaturas dos professores e pagamentos" />
      <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'ALL', label: 'Todas' },
            { value: 'ACTIVE', label: 'Ativas' },
            { value: 'TRIALING', label: 'Em teste' },
            { value: 'PAST_DUE', label: 'Inadimplentes' },
            { value: 'CANCELED', label: 'Canceladas' },
          ]}
        />
      </div>
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <Card>
          <EmptyState icon={<CreditCard className="size-5" />} title="Nenhuma assinatura" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] whitespace-nowrap text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-3 font-medium">Professor</th>
                  <th className="px-4 py-3 font-medium">Plano</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Alunos</th>
                  <th className="px-4 py-3 font-medium">Período até</th>
                  <th className="px-4 py-3 font-medium">Último pagamento</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {q.data!.map((s) => {
                  const last = s.payments[0];
                  return (
                    <tr key={s.id} className="hover:bg-surface-2/50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{s.trainer.user.name}</p>
                        <p className="text-xs text-muted">{s.trainer.user.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{s.plan.name}</p>
                        <p className="tabular text-xs text-muted">
                          {formatCurrency(s.plan.priceCents, s.plan.currency)}/{s.plan.interval === 'YEARLY' ? 'ano' : 'mês'} · {s.provider}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                          {s.cancelAtPeriodEnd && <span className="text-[11px] text-warning">cancela no fim do período</span>}
                        </div>
                      </td>
                      <td className="tabular px-4 py-3">
                        {s.trainer._count.students}
                        <span className="text-muted">/{s.plan.maxStudents ?? '∞'}</span>
                      </td>
                      <td className="tabular px-4 py-3 text-muted">{fmtDate(s.currentPeriodEnd)}</td>
                      <td className="tabular px-4 py-3 text-muted">{last ? `${formatCurrency(last.amountCents)} · ${fmtDate(last.paidAt ?? last.createdAt)}` : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="secondary" onClick={() => setPayFor(s)}>
                          <Receipt className="size-3.5" /> Registrar pagamento
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {payFor && <PaymentModal sub={payFor} onClose={() => setPayFor(null)} />}
    </div>
  );
}

function PaymentModal({ sub, onClose }: { sub: AdminSubscription; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [amount, setAmount] = useState((sub.plan.priceCents / 100).toFixed(2).replace('.', ','));
  const cents = Math.round(Number(amount.replace(/\./g, '').replace(',', '.')) * 100);
  const m = useMutation({
    mutationFn: () => api(`/admin/subscriptions/${sub.id}/payments`, { method: 'POST', body: { amountCents: cents } }),
    onSuccess: () => {
      toast.success('Pagamento registrado', 'A assinatura foi renovada.');
      qc.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      qc.invalidateQueries({ queryKey: ['admin-metrics'] });
      onClose();
    },
    onError: (e) => toast.error('Erro ao registrar', errorMessage(e)),
  });
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="Registrar pagamento manual"
      description={`${sub.trainer.user.name} · ${sub.plan.name}`}
      footer={
        <Button loading={m.isPending} disabled={!cents || cents <= 0} onClick={() => m.mutate()}>
          Registrar {cents > 0 ? formatCurrency(cents) : ''}
        </Button>
      }
    >
      <Input label="Valor (R$)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} hint="Use para PIX, boleto ou transferência recebidos fora do gateway." />
    </Modal>
  );
}
