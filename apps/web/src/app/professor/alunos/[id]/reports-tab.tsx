'use client';

import { formatDuration, type WeeklyReport } from '@personalpro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Sparkles, Trophy } from 'lucide-react';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { fmtDate, fmtNumber, fmtSigned } from '@/lib/format';

export function ReportsTab({ studentId }: { studentId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const reports = useQuery({ queryKey: ['reports', studentId], queryFn: () => api<WeeklyReport[]>('/reports/weekly', { query: { studentId } }) });
  const generate = useMutation({
    mutationFn: () => api('/reports/weekly', { method: 'POST', body: { studentId } }),
    onSuccess: () => {
      toast.success('Relatório gerado', 'Resumo da semana anterior criado.');
      qc.invalidateQueries({ queryKey: ['reports', studentId] });
    },
    onError: (e) => toast.error('Não foi possível gerar', errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Gerados automaticamente toda segunda-feira às 07:00.</p>
        <Button loading={generate.isPending} onClick={() => generate.mutate()}>
          <Sparkles className="size-4" /> Gerar relatório
        </Button>
      </div>
      {reports.isLoading ? (
        <LoadingBlock />
      ) : reports.isError ? (
        <ErrorState error={reports.error} />
      ) : reports.data!.length === 0 ? (
        <Card>
          <EmptyState icon={<FileText className="size-5" />} title="Nenhum relatório ainda" description="Gere agora o resumo da última semana: frequência, volume, evolução de peso e recordes." />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {reports.data!.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">Semana de {fmtDate(r.weekStart)}</p>
                <Badge tone={r.data.attendancePct >= 75 ? 'success' : r.data.attendancePct >= 40 ? 'warning' : 'danger'}>{Math.round(r.data.attendancePct)}% de frequência</Badge>
              </div>
              <p className="mt-2 text-sm text-muted">{r.summary}</p>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Metric label="Treinos" value={`${r.data.sessionsCount}/${r.data.plannedPerWeek}`} />
                <Metric label="Volume" value={`${fmtNumber(r.data.totalVolumeKg, 0)} kg`} sub={r.data.volumeChangePct !== null ? fmtSigned(r.data.volumeChangePct, '%') : undefined} />
                <Metric label="Tempo" value={r.data.totalDurationSeconds ? formatDuration(r.data.totalDurationSeconds) : '—'} />
                <Metric label="Peso" value={fmtSigned(r.data.weightDeltaKg, 'kg')} />
              </dl>
              {(r.data.highlights.length > 0 || r.data.personalRecords > 0) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.data.personalRecords > 0 && (
                    <Badge tone="accent">
                      <Trophy className="size-3" /> {r.data.personalRecords} recorde(s)
                    </Badge>
                  )}
                  {r.data.highlights.map((h) => (
                    <Badge key={h.name}>
                      {h.name} {fmtSigned(h.deltaKg, 'kg')}
                    </Badge>
                  ))}
                </div>
              )}
              {r.data.aiNarrative && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm text-muted">{r.data.aiNarrative}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular mt-0.5 text-sm font-semibold">
        {value} {sub && <span className="text-[11px] font-normal text-muted">{sub}</span>}
      </dd>
    </div>
  );
}
