import type { MySubscription, Plan } from '@personalpro/shared';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Badge, Button, Card, Divider, KeyValue, ProgressBar, QueryState, Row, Screen, Section, T } from '@/components/ui';
import { useApi, useInvalidate, useRefresh } from '@/features/hooks';
import { confirm, notify, notifyError } from '@/lib/alert';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney } from '@/lib/format';
import { useTheme } from '@/theme';

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  ACTIVE: { label: 'Ativa', tone: 'success' },
  TRIALING: { label: 'Período de teste', tone: 'info' },
  PAST_DUE: { label: 'Pagamento pendente', tone: 'warning' },
  CANCELED: { label: 'Cancelada', tone: 'danger' },
};

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const sub = useApi<MySubscription>(['subscription'], '/subscriptions/me');
  const plans = useApi<Plan[]>(['plans'], '/plans');
  const { refreshing, onRefresh } = useRefresh(sub.refetch, plans.refetch);
  const [busy, setBusy] = useState<string | null>(null);
  const s = sub.data?.subscription;

  const checkout = async (plan: Plan) => {
    setBusy(plan.code);
    try {
      const res = await api.post<{ checkoutUrl: string | null }>('/subscriptions/checkout', { planCode: plan.code });
      if (res.checkoutUrl) await WebBrowser.openBrowserAsync(res.checkoutUrl);
      else notify('Plano atualizado', `Você agora está no plano ${plan.name}.`);
      await invalidate(['subscription'], ['dashboard']);
    } catch (e) {
      notifyError(e, 'Não foi possível iniciar o pagamento');
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (!(await confirm('Cancelar assinatura', 'O plano continua ativo até o fim do período atual.', { confirmText: 'Cancelar assinatura', destructive: true }))) return;
    try {
      await api.post('/subscriptions/cancel');
      await invalidate(['subscription'], ['dashboard']);
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <Screen title="Assinatura" back refreshing={refreshing} onRefresh={onRefresh}>
      <QueryState query={sub}>
        {sub.data ? (
          <Card style={{ borderColor: sub.data.entitled ? colors.accent : colors.warning, borderWidth: 1 }}>
            {s ? (
              <>
                <Row justify="space-between">
                  <T variant="h2">{s.plan.name}</T>
                  <Badge label={STATUS[s.status]?.label ?? s.status} tone={STATUS[s.status]?.tone ?? 'info'} />
                </Row>
                <T tone="secondary" style={{ marginTop: 4 }}>
                  {fmtMoney(s.plan.priceCents, s.plan.currency)} / {s.plan.interval === 'YEARLY' ? 'ano' : 'mês'}
                </T>
                <View style={{ marginTop: 14 }}>
                  <ProgressBar value={sub.data.usage.maxStudents ? (sub.data.usage.students / sub.data.usage.maxStudents) * 100 : 5} />
                  <T variant="small" tone="secondary" style={{ marginTop: 6 }}>
                    {sub.data.usage.students} de {sub.data.usage.maxStudents ?? 'ilimitados'} alunos
                  </T>
                </View>
                <Divider style={{ marginVertical: 12 }} />
                <KeyValue label={s.cancelAtPeriodEnd ? 'Encerra em' : 'Próxima renovação'} value={fmtDate(s.currentPeriodEnd)} />
                <KeyValue label="Forma de pagamento" value={s.provider === 'MANUAL' ? 'Manual' : s.provider} />
                {!s.cancelAtPeriodEnd && s.status !== 'CANCELED' ? (
                  <Button title="Cancelar assinatura" variant="ghost" onPress={cancel} style={{ marginTop: 8 }} />
                ) : null}
              </>
            ) : (
              <Row gap={10}>
                <Icon name="alert" color={colors.warning} />
                <T style={{ flex: 1 }}>Você não possui assinatura ativa. Escolha um plano para cadastrar alunos.</T>
              </Row>
            )}
          </Card>
        ) : null}
      </QueryState>

      <Section title="Planos">
        <QueryState query={plans}>
          <View style={{ gap: 12 }}>
            {(plans.data ?? [])
              .filter((p) => p.active)
              .map((p) => {
                const current = s?.plan.code === p.code && s.status !== 'CANCELED';
                return (
                  <Card key={p.id} style={current ? { borderColor: colors.accent, borderWidth: 1.5 } : undefined}>
                    <Row justify="space-between">
                      <T variant="h3">{p.name}</T>
                      {current ? <Badge label="Plano atual" tone="accent" /> : null}
                    </Row>
                    <T variant="h1" style={{ marginTop: 6 }}>
                      {fmtMoney(p.priceCents, p.currency)}
                      <T tone="muted"> /{p.interval === 'YEARLY' ? 'ano' : 'mês'}</T>
                    </T>
                    <T tone="secondary">{p.description ?? (p.maxStudents ? `Até ${p.maxStudents} alunos` : 'Alunos ilimitados')}</T>
                    {!current ? (
                      <Button title="Assinar este plano" style={{ marginTop: 12 }} onPress={() => checkout(p)} loading={busy === p.code} />
                    ) : null}
                  </Card>
                );
              })}
          </View>
        </QueryState>
      </Section>

      {s?.payments.length ? (
        <Section title="Pagamentos">
          <Card padding={12}>
            {s.payments.map((pay) => (
              <KeyValue key={pay.id} label={fmtDate(pay.paidAt ?? pay.createdAt)} value={`${fmtMoney(pay.amountCents)} · ${pay.status === 'PAID' ? 'Pago' : pay.status}`} />
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
