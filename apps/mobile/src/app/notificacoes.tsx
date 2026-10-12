import type { AppNotification, NotificationType, Paginated } from '@personalpro/shared';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { Button, Card, EmptyState, QueryState, Row, Screen, T } from '@/components/ui';
import { useApi, useInvalidate, useRefresh } from '@/features/hooks';
import { notifyError } from '@/lib/alert';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useTheme } from '@/theme';

const ICONS: Record<NotificationType, IconName> = {
  WORKOUT_REMINDER: 'clock',
  WORKOUT_UPDATED: 'dumbbell',
  INACTIVITY: 'alert',
  MILESTONE: 'award',
  PERSONAL_RECORD: 'award',
  APPOINTMENT: 'calendar',
  MESSAGE: 'message',
  ASSESSMENT: 'clipboard',
  GOAL: 'target',
  AI_SUGGESTION: 'sparkles',
  WEEKLY_REPORT: 'bar-chart',
  SYSTEM: 'info',
};

type NotificationsPage = Paginated<AppNotification> & { unread: number };

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const q = useApi<NotificationsPage>(['notifications'], '/notifications', { pageSize: 50 });
  const invalidate = useInvalidate();
  const { refreshing, onRefresh } = useRefresh(q.refetch);

  const open = async (n: AppNotification) => {
    try {
      if (!n.readAt) await api.post(`/notifications/${n.id}/read`);
      await invalidate(['notifications'], ['dashboard']);
    } catch (e) {
      notifyError(e);
    }
    if (n.data?.conversationId) router.push(`/chat/${n.data.conversationId}`);
  };

  const readAll = async () => {
    try {
      await api.post('/notifications/read-all');
      await invalidate(['notifications'], ['dashboard']);
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <Screen
      title="Notificações"
      subtitle={q.data ? `${q.data.unread} não lidas` : undefined}
      back
      refreshing={refreshing}
      onRefresh={onRefresh}
      right={q.data?.unread ? <Button title="Ler todas" size="sm" variant="ghost" full={false} onPress={readAll} /> : null}
    >
      <QueryState query={q}>
        {q.data?.items.length ? (
          <View style={{ gap: 10 }}>
            {q.data.items.map((n) => (
              <Pressable key={n.id} onPress={() => open(n)}>
                <Card style={!n.readAt ? { borderColor: colors.accent, borderWidth: 1 } : undefined}>
                  <Row gap={12} align="flex-start">
                    <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={ICONS[n.type] ?? 'bell'} color={colors.accent} size={18} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Row justify="space-between" align="flex-start">
                        <T variant="bodyStrong" style={{ flex: 1 }}>
                          {n.title}
                        </T>
                        <T variant="small" tone="muted">
                          {timeAgo(n.createdAt)}
                        </T>
                      </Row>
                      <T tone="secondary" style={{ marginTop: 2 }}>
                        {n.body}
                      </T>
                    </View>
                  </Row>
                </Card>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState icon="bell" title="Tudo em dia" message="Você não tem notificações no momento." />
        )}
      </QueryState>
    </Screen>
  );
}
