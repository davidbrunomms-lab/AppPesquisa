import type { AiSuggestion, AiSuggestionStatus, AiSuggestionType } from '@personalpro/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { Avatar, Badge, Button, Card, EmptyState, QueryState, Row, Screen, Segmented, T } from '@/components/ui';
import { useApi, useInvalidate, useRefresh } from '@/features/hooks';
import { notify, notifyError } from '@/lib/alert';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useTheme } from '@/theme';

const TYPE: Record<AiSuggestionType, { label: string; icon: IconName }> = {
  LOAD_PROGRESSION: { label: 'Progressão de carga', icon: 'trending-up' },
  LOW_FREQUENCY: { label: 'Baixa frequência', icon: 'alert' },
  STAGNATION: { label: 'Estagnação', icon: 'activity' },
  WORKOUT_ADJUSTMENT: { label: 'Ajuste de treino', icon: 'edit' },
  WEEKLY_SUMMARY: { label: 'Resumo semanal', icon: 'bar-chart' },
  RECOMMENDATION: { label: 'Recomendação', icon: 'sparkles' },
};

/** Sugestões da IA: nunca alteram treinos sem aprovação explícita do professor. */
export default function AiSuggestionsScreen() {
  const { colors } = useTheme();
  const [status, setStatus] = useState<AiSuggestionStatus>('PENDING');
  const q = useApi<AiSuggestion[]>(['ai', status], '/ai/suggestions', { status });
  const invalidate = useInvalidate();
  const { refreshing, onRefresh } = useRefresh(q.refetch);
  const [busy, setBusy] = useState<string | null>(null);

  const analyze = async () => {
    setBusy('analyze');
    try {
      const res = await api.post<{ students: number; suggestions: number }>('/ai/analyze');
      await invalidate(['ai'], ['dashboard']);
      notify('Análise concluída', `${res.students} aluno(s) analisado(s) · ${res.suggestions} sugestão(ões) gerada(s).`);
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(null);
    }
  };

  const review = async (s: AiSuggestion, action: 'approve' | 'reject') => {
    setBusy(s.id + action);
    try {
      await api.post(`/ai/suggestions/${s.id}/${action}`);
      await invalidate(['ai'], ['dashboard'], ['workouts']);
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title="Sugestões da IA" back refreshing={refreshing} onRefresh={onRefresh}>
      <Card style={{ borderColor: colors.info, borderWidth: 1, marginBottom: 16 }}>
        <Row gap={10} align="flex-start">
          <Icon name="shield" color={colors.info} size={20} />
          <T variant="small" tone="secondary" style={{ flex: 1 }}>
            A IA analisa frequência, cargas e evolução dos alunos e <T variant="small" style={{ fontWeight: '800' }}>apenas sugere</T>. Nenhum treino é alterado sem a sua aprovação explícita.
          </T>
        </Row>
      </Card>
      <Button title="Analisar agora" icon="sparkles" onPress={analyze} loading={busy === 'analyze'} />
      <View style={{ height: 16 }} />
      <Segmented
        options={[
          { value: 'PENDING', label: 'Pendentes' },
          { value: 'APPLIED', label: 'Aplicadas' },
          { value: 'APPROVED', label: 'Aprovadas' },
          { value: 'REJECTED', label: 'Rejeitadas' },
        ]}
        value={status}
        onChange={setStatus}
      />
      <QueryState query={q}>
        {q.data?.length ? (
          <View style={{ gap: 12 }}>
            {q.data.map((s) => {
              const t = TYPE[s.type] ?? TYPE.RECOMMENDATION;
              return (
                <Card key={s.id}>
                  <Row gap={10} style={{ marginBottom: 8 }}>
                    <Avatar name={s.student?.user.name} url={s.student?.user.avatarUrl} size={34} />
                    <View style={{ flex: 1 }}>
                      <T variant="bodyStrong">{s.student?.user.name ?? 'Aluno'}</T>
                      <T variant="small" tone="muted">
                        {timeAgo(s.createdAt)} · {s.source === 'llm' ? 'IA generativa' : 'Motor de regras'}
                      </T>
                    </View>
                    <Badge label={t.label} icon={t.icon} tone="accent" />
                  </Row>
                  <T variant="h3">{s.title}</T>
                  <T tone="secondary" style={{ marginTop: 4 }}>
                    {s.content}
                  </T>
                  {s.status === 'PENDING' ? (
                    <Row gap={10} style={{ marginTop: 14 }}>
                      <View style={{ flex: 1 }}>
                        <Button title="Rejeitar" icon="x" variant="secondary" size="sm" onPress={() => review(s, 'reject')} loading={busy === s.id + 'reject'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button title="Aprovar" icon="check" size="sm" onPress={() => review(s, 'approve')} loading={busy === s.id + 'approve'} />
                      </View>
                    </Row>
                  ) : null}
                </Card>
              );
            })}
          </View>
        ) : (
          <EmptyState icon="sparkles" title="Nenhuma sugestão" message={status === 'PENDING' ? 'Toque em "Analisar agora" para gerar novas sugestões.' : undefined} />
        )}
      </QueryState>
    </Screen>
  );
}
