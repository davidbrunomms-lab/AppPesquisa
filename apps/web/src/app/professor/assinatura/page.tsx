'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SubscriptionCard } from '@/components/subscription-card';
import { PageHeader } from '@/components/ui';

/** Retorno do checkout do gateway: /professor/assinatura?status=sucesso|cancelado */
export default function SubscriptionPage() {
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => setStatus(new URLSearchParams(window.location.search).get('status')), []);
  return (
    <div>
      <PageHeader title="Assinatura" subtitle="Planos por número de alunos ativos" />
      {status === 'sucesso' && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success-soft p-3 text-sm text-success">
          <CheckCircle2 className="size-4" /> Pagamento recebido! A confirmação pode levar alguns instantes.
        </p>
      )}
      {status === 'cancelado' && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
          <XCircle className="size-4" /> Checkout cancelado. Nenhuma cobrança foi feita.
        </p>
      )}
      <SubscriptionCard />
    </div>
  );
}
