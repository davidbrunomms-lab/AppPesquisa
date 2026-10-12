import type { Conversation } from '@personalpro/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Avatar, Badge, Card, Divider, EmptyState, ListItem, QueryState, Screen } from '@/components/ui';
import { useApi, useRefresh } from '@/features/hooks';
import { timeAgo } from '@/lib/format';

const PREVIEW: Record<string, string> = { IMAGE: '📷 Foto', VIDEO: '🎬 Vídeo', AUDIO: '🎤 Áudio', FILE: '📎 Arquivo' };

export default function ConversationsScreen() {
  const q = useApi<Conversation[]>(['conversations'], '/conversations', undefined, { refetchInterval: 20_000 });
  const { refreshing, onRefresh } = useRefresh(q.refetch);
  return (
    <Screen title="Conversas" back refreshing={refreshing} onRefresh={onRefresh}>
      <QueryState query={q}>
        {q.data?.length ? (
          <Card padding={10}>
            {q.data.map((c, i) => (
              <View key={c.id}>
                {i > 0 ? <Divider /> : null}
                <ListItem
                  left={<Avatar name={c.participant.name} url={c.participant.avatarUrl} />}
                  title={c.participant.name}
                  subtitle={
                    c.lastMessage
                      ? `${c.lastMessage.isQuestion ? '❓ ' : ''}${c.lastMessage.content ?? PREVIEW[c.lastMessage.type] ?? ''} · ${timeAgo(c.lastMessage.createdAt)}`
                      : 'Sem mensagens'
                  }
                  right={c.unreadCount ? <Badge label={String(c.unreadCount)} tone="danger" /> : undefined}
                  onPress={() => router.push(`/chat/${c.id}`)}
                />
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState icon="message" title="Nenhuma conversa" message="As conversas com seus alunos aparecem aqui." />
        )}
      </QueryState>
    </Screen>
  );
}
