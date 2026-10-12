'use client';

import type { AiSuggestion, AiSuggestionStatus, AiSuggestionType } from '@personalpro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, ShieldCheck, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Segmented } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';

const TYPE_LABELS: Record<AiSuggestionType, string> = {
  LOAD_PROGRESSION: 'Progressão de carga',
  LOW_FREQUENCY: 'Baixa frequência',
  STAGNATION: 'Estagnação',
  WORKOUT_ADJUSTMENT: 'Ajuste de treino',
  WEEKLY_SUMMARY: 'Resumo semanal',
  RECOMMENDATION: 'Recomendação',
};
const STATUS_LABELS: Record<AiSuggestionStatus, string> = { PENDING: 'Pendente', APPROVED: 'Aprovada', REJECTED: 'Rejeitada', APPLIED: 'Aplicada' };

export default function AiPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<'PENDING' | 'ALL'>('PENDING');
  const q = useQuery({
    queryKey: ['ai-suggestions', status],
    queryFn: () => api<AiSuggestion[]>('/ai/suggestions', { query: { status: status === 'ALL' ? undefined : status } }),
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ai-suggestions'] });
    qc.invalidateQueries({ queryKey: ['dashboard-trainer'] });
  };
  const analyze = useMutation({
    mutationFn: () => api<{ students: number; suggestions: number }>('/ai/analyze', { method: 'POST' }),
    onSuccess: (r) => {
      toast.success('Análise concluída', `${r.students} aluno(s) analisados · ${r.suggestions} nova(s) sugestão(ões).`);
      invalidate();
    },
    onError: (e) => toast.error('Falha na análise', errorMessage(e)),
  });
  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) => api<AiSuggestion>(`/ai/suggestions/${id}/${action}`, { method: 'POST' }),
    onSuccess: (s) => {
      toast.success(s.status === 'APPLIED' ? 'Sugestão aplicada ao treino' : s.status === 'APPROVED' ? 'Sugestão aprovada' : 'Sugestão rejeitada');
      invalidate();
      qc.invalidateQueries({ queryKey: ['workouts'] });
    },
    onError: (e) => toast.error('Erro', errorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Assistente de IA"
        subtitle="Sugestões baseadas no histórico de treinos dos seus alunos"
        actions={
          <Button loading={analyze.isPending} onClick={() => analyze.mutate()}>
            <Sparkles className="size-4" /> Analisar agora
          </Button>
        }
      />
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-info/30 bg-info-soft p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-info" />
        <p>
          <span className="font-semibold text-fg">Você no controle.</span> <span className="text-muted">A IA nunca altera treinos sozinha. As sugestões só têm efeito depois da sua aprovação — e progressões de carga aprovadas são aplicadas na ficha e o aluno é avisado.</span>
        </p>
      </div>
      <Segmented
        className="mb-4"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'PENDING', label: 'Pendentes' },
          { value: 'ALL', label: 'Todas' },
        ]}
      />
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <Card>
          <EmptyState icon={<Sparkles className="size-5" />} title="Nenhuma sugestão pendente" description="A análise roda automaticamente todos os dias às 06:00. Você também pode analisar agora." />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {q.data!.map((s) => {
            const from = s.payload.fromKg as number | undefined;
            const to = s.payload.suggestedLoadKg as number | undefined;
            return (
              <Card key={s.id} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/professor/alunos/${s.studentId}`} className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={s.student?.user.name} src={s.student?.user.avatarUrl} size={34} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{s.student?.user.name ?? 'Aluno'}</p>
                      <p className="text-xs text-muted">{fmtDateTime(s.createdAt)}</p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone="info">{TYPE_LABELS[s.type]}</Badge>
                    {s.status !== 'PENDING' && <Badge tone={s.status === 'REJECTED' ? 'danger' : 'success'}>{STATUS_LABELS[s.status]}</Badge>}
                  </div>
                </div>
                <p className="mt-3 font-semibold">{s.title}</p>
                <p className="mt-1 text-sm text-muted">{s.content}</p>
                {from !== undefined && to !== undefined && (
                  <div className="mt-3 inline-flex w-fit items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                    <span className="tabular">{from} kg</span>
                    <ArrowRight className="size-4 text-accent-ink" />
                    <span className="tabular font-semibold text-accent-ink">{to} kg</span>
                  </div>
                )}
                {s.status === 'PENDING' && (
                  <div className="mt-4 flex gap-2 border-t border-border pt-3">
                    <Button className="flex-1" loading={review.isPending && review.variables?.id === s.id && review.variables.action === 'approve'} onClick={() => review.mutate({ id: s.id, action: 'approve' })}>
                      <Check className="size-4" /> Aprovar
                    </Button>
                    <Button variant="secondary" className="flex-1" loading={review.isPending && review.variables?.id === s.id && review.variables.action === 'reject'} onClick={() => review.mutate({ id: s.id, action: 'reject' })}>
                      <X className="size-4" /> Rejeitar
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
