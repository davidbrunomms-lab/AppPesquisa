'use client';

import { formatCurrency, type Plan } from '@personalpro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, Checkbox, EmptyState, ErrorState, Input, LoadingBlock, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';

type AdminPlan = Plan & { _count?: { subscriptions: number } };

export default function AdminPlansPage() {
  const [editing, setEditing] = useState<AdminPlan | 'new' | null>(null);
  const q = useQuery({ queryKey: ['admin-plans'], queryFn: () => api<AdminPlan[]>('/admin/plans') });
  return (
    <div>
      <PageHeader
        title="Planos"
        subtitle="Planos de assinatura oferecidos aos professores"
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Novo plano
          </Button>
        }
      />
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <Card>
          <EmptyState icon={<Package className="size-5" />} title="Nenhum plano cadastrado" />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {q.data!.map((p) => (
            <Card key={p.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="font-mono text-[11px] text-subtle">{p.code}</p>
                </div>
                <Badge tone={p.active ? 'success' : 'default'}>{p.active ? 'Ativo' : 'Inativo'}</Badge>
              </div>
              <p className="mt-4">
                <span className="tabular text-3xl font-semibold tracking-tight">{formatCurrency(p.priceCents, p.currency)}</span>
                <span className="text-sm text-muted">/{p.interval === 'YEARLY' ? 'ano' : 'mês'}</span>
              </p>
              <p className="mt-1 text-sm text-muted">{p.maxStudents ? `Até ${p.maxStudents} alunos` : 'Alunos ilimitados'}</p>
              {p.description && <p className="mt-2 text-sm text-muted">{p.description}</p>}
              <div className="mt-auto flex items-center justify-between border-t border-border pt-3" style={{ marginTop: 16 }}>
                <span className="text-xs text-muted">{p._count?.subscriptions ?? 0} assinatura(s)</span>
                <Button size="sm" variant="secondary" onClick={() => setEditing(p)}>
                  <Pencil className="size-3.5" /> Editar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <PlanModal plan={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PlanModal({ plan, onClose }: { plan: AdminPlan | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({
    code: plan?.code ?? '',
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    maxStudents: plan?.maxStudents?.toString() ?? '',
    price: plan ? (plan.priceCents / 100).toFixed(2).replace('.', ',') : '',
    interval: plan?.interval ?? 'MONTHLY',
  });
  const [active, setActive] = useState(plan?.active ?? true);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const cents = Math.round(Number(f.price.replace(/\./g, '').replace(',', '.')) * 100);
  const m = useMutation({
    mutationFn: () => {
      const body = {
        code: f.code.trim().toUpperCase(),
        name: f.name.trim(),
        description: f.description.trim() || undefined,
        maxStudents: f.maxStudents.trim() === '' ? null : Number(f.maxStudents),
        priceCents: cents,
        interval: f.interval,
        active,
      };
      return plan ? api(`/admin/plans/${plan.id}`, { method: 'PATCH', body }) : api('/admin/plans', { method: 'POST', body });
    },
    onSuccess: () => {
      toast.success(plan ? 'Plano atualizado' : 'Plano criado');
      qc.invalidateQueries({ queryKey: ['admin-plans'] });
      qc.invalidateQueries({ queryKey: ['plans'] });
      onClose();
    },
    onError: (e) => toast.error('Não foi possível salvar', errorMessage(e)),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={plan ? `Editar ${plan.name}` : 'Novo plano'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={m.isPending} disabled={!f.code.trim() || !f.name.trim() || !(cents >= 0) || f.price === ''} onClick={() => m.mutate()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Nome" value={f.name} onChange={set('name')} placeholder="Personal Pro" />
        <Input label="Código" value={f.code} onChange={set('code')} placeholder="PERSONAL_PRO" className="font-mono uppercase" />
        <Input label="Preço (R$)" inputMode="decimal" value={f.price} onChange={set('price')} placeholder="99,90" hint={cents > 0 ? formatCurrency(cents) : undefined} />
        <Select
          label="Cobrança"
          value={f.interval}
          onChange={set('interval')}
          options={[
            { value: 'MONTHLY', label: 'Mensal' },
            { value: 'YEARLY', label: 'Anual' },
          ]}
        />
        <Input label="Máximo de alunos" type="number" min={1} value={f.maxStudents} onChange={set('maxStudents')} hint="Vazio = ilimitado" />
        <div className="flex items-end pb-3">
          <Checkbox checked={active} onChange={setActive}>
            Plano ativo (visível para contratação)
          </Checkbox>
        </div>
        <Textarea label="Descrição" value={f.description} onChange={set('description')} wrapperClassName="sm:col-span-2" className="min-h-16" />
      </div>
    </Modal>
  );
}
