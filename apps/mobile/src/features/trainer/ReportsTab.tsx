import { formatDuration, type WeeklyReport } from '@personalpro/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, EmptyState, QueryState, Row, T } from '@/components/ui';
import { useApi, useInvalidate } from '@/features/hooks';
import { notifyError } from '@/lib/alert';
import { api } from '@/lib/api';
import { fmtDate, fmtNumber } from '@/lib/format';

/** Relatórios semanais (gerados automaticamente às segundas ou sob demanda). */
export function ReportsTab({ studentId }: { studentId: string }) {
  const invalidate = useInvalidate();
  const q = useApi<WeeklyReport[]>(['reports', studentId], '/reports/weekly', { studentId });
  const [loading, setLoading] = useState(false);
  const generate = async () => {
    setLoading(true);
    try {
      await api.post('/reports/weekly', { studentId });
      await invalidate(['reports', studentId]);
    } catch (e) {
      notifyError(e);
    } finally {
      setLoading(false);
    }
  };
  return (
    <View>
      <Button title="Gerar relatório da semana" icon="bar-chart" onPress={generate} loading={loading} />
      <View style={{ height: 14 }} />
      <QueryState query={q}>
        {q.data?.length ? (
          <View style={{ gap: 12 }}>
            {q.data.map((r) => (
              <Card key={r.id}>
                <Row justify="space-between" style={{ marginBottom: 8 }}>
                  <T variant="h3">Semana de {fmtDate(r.weekStart)}</T>
                  <Badge label={`${r.data.attendancePct}% frequência`} tone={r.data.attendancePct >= 75 ? 'success' : 'warning'} />
                </Row>
                <T tone="secondary">{r.summary}</T>
                <Row gap={6} wrap style={{ marginTop: 10 }}>
                  <Badge label={`${r.data.sessionsCount}/${r.data.plannedPerWeek} treinos`} />
                  <Badge label={`${fmtNumber(r.data.totalVolumeKg, 0)} kg volume`} />
                  {r.data.totalDurationSeconds ? <Badge label={formatDuration(r.data.totalDurationSeconds)} /> : null}
                  {r.data.personalRecords ? <Badge label={`${r.data.personalRecords} recordes`} tone="warning" /> : null}
                </Row>
                {r.data.aiNarrative ? (
                  <T variant="small" tone="muted" style={{ marginTop: 10 }}>
                    ✨ {r.data.aiNarrative}
                  </T>
                ) : null}
              </Card>
            ))}
          </View>
        ) : (
          <EmptyState icon="bar-chart" title="Nenhum relatório" message="Os relatórios são gerados toda segunda-feira." />
        )}
      </QueryState>
    </View>
  );
}
