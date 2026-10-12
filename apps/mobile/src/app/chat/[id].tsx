import type { Conversation, Message } from '@personalpro/shared';
import { formatDuration } from '@personalpro/shared';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, TextInput, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AudioPlayerBubble, VideoPlayer } from '@/components/Media';
import { Sheet } from '@/components/Sheet';
import { Avatar, Badge, ErrorState, ListItem, Loading, Row, Screen, T } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useApi, useInvalidate } from '@/features/hooks';
import { notify, notifyError } from '@/lib/alert';
import { api, buildFileForm, type LocalFile } from '@/lib/api';
import { absoluteUrl } from '@/lib/config';
import { fmtDate, fmtTime } from '@/lib/format';
import { pickDocument, pickFromLibrary, takePhoto } from '@/lib/media';
import { getChatSocket } from '@/lib/socket';
import { useTheme } from '@/theme';

const PAGE = 30;

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors, radius } = useTheme();
  const invalidate = useInvalidate();
  const conversations = useApi<Conversation[]>(['conversations'], '/conversations');
  const conversation = conversations.data?.find((c) => c.id === id);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmit = useRef(0);

  const merge = useCallback((incoming: Message[]) => {
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]));
      incoming.forEach((m) => map.set(m.id, m));
      return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }, []);

  const markRead = useCallback(async () => {
    try {
      await api.post(`/conversations/${id}/read`);
      await invalidate(['conversations'], ['dashboard']);
    } catch {
      // ignora
    }
  }, [id, invalidate]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const items = await api.get<Message[]>(`/conversations/${id}/messages`, { limit: PAGE });
      setMessages(items);
      setHasMore(items.length >= PAGE);
      void markRead();
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [id, markRead]);

  useEffect(() => {
    void load();
  }, [load]);

  // Tempo real (socket.io /chat)
  useEffect(() => {
    const socket = getChatSocket();
    if (!socket) return;
    const onMessage = (m: Message) => {
      if (m.trainerStudentId !== id) return;
      merge([m]);
      if (m.senderId !== user?.id) void markRead();
    };
    const onRead = (p: { conversationId: string; readerId?: string }) => {
      if (p.conversationId !== id || p.readerId === user?.id) return;
      setMessages((prev) => prev.map((m) => (m.senderId === user?.id && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m)));
    };
    const onTyping = (p: { conversationId: string; userId?: string }) => {
      if (p.conversationId !== id || p.userId === user?.id) return;
      setTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 3000);
    };
    socket.on('message', onMessage);
    socket.on('read', onRead);
    socket.on('typing', onTyping);
    return () => {
      socket.off('message', onMessage);
      socket.off('read', onRead);
      socket.off('typing', onTyping);
    };
  }, [id, user?.id, merge, markRead]);

  const loadOlder = async () => {
    if (!hasMore || loadingMore || !messages.length) return;
    setLoadingMore(true);
    try {
      const older = await api.get<Message[]>(`/conversations/${id}/messages`, { limit: PAGE, before: messages[0].createdAt });
      merge(older);
      setHasMore(older.length >= PAGE);
    } catch {
      // ignora
    } finally {
      setLoadingMore(false);
    }
  };

  const sendText = async () => {
    const content = text.trim();
    if (!content) return;
    setSending(true);
    try {
      const m = await api.post<Message>(`/conversations/${id}/messages`, { type: 'TEXT', content });
      merge([m]);
      setText('');
      void invalidate(['conversations']);
    } catch (e) {
      notifyError(e, 'Mensagem não enviada');
    } finally {
      setSending(false);
    }
  };

  const sendFile = async (file: LocalFile | null) => {
    setAttachOpen(false);
    if (!file) return;
    setSending(true);
    try {
      const m = await api.upload<Message>(`/conversations/${id}/attachments`, await buildFileForm(file));
      merge([m]);
      void invalidate(['conversations']);
    } catch (e) {
      notifyError(e, 'Arquivo não enviado');
    } finally {
      setSending(false);
    }
  };

  const onChangeText = (t: string) => {
    setText(t);
    const now = Date.now();
    if (now - lastTypingEmit.current > 2000) {
      lastTypingEmit.current = now;
      getChatSocket()?.emit('typing', { conversationId: id });
    }
  };

  const data = [...messages].reverse();

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        back
        scroll={false}
        padded={false}
        title={conversation?.participant.name ?? 'Conversa'}
        subtitle={typing ? 'digitando…' : user?.role === 'STUDENT' ? 'Seu personal' : 'Aluno'}
        right={conversation ? <Avatar name={conversation.participant.name} url={conversation.participant.avatarUrl} size={38} /> : null}
      >
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState error={error} onRetry={load} />
        ) : (
          <FlatList
            data={data}
            inverted
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.2}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.accent} /> : null}
            ListEmptyComponent={
              <View style={{ transform: [{ scaleY: -1 }], paddingVertical: 40 }}>
                <T tone="muted" center>
                  Nenhuma mensagem ainda. Diga olá! 👋
                </T>
              </View>
            }
            renderItem={({ item, index }) => {
              const prev = data[index + 1];
              const showDay = !prev || fmtDate(prev.createdAt) !== fmtDate(item.createdAt);
              return (
                <View>
                  {showDay ? (
                    <T variant="caption" tone="muted" center style={{ marginVertical: 8 }}>
                      {fmtDate(item.createdAt)}
                    </T>
                  ) : null}
                  <Bubble message={item} mine={item.senderId === user?.id} />
                </View>
              );
            }}
          />
        )}
        <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 28 : 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
          <Row gap={8} align="flex-end">
            <Pressable onPress={() => setAttachOpen(true)} hitSlop={8} accessibilityLabel="Anexar" style={{ padding: 8 }}>
              <Icon name="paperclip" color={colors.textSecondary} />
            </Pressable>
            <TextInput
              value={text}
              onChangeText={onChangeText}
              placeholder="Mensagem"
              placeholderTextColor={colors.textMuted}
              multiline
              style={{
                flex: 1,
                maxHeight: 120,
                minHeight: 42,
                backgroundColor: colors.surfaceMuted,
                color: colors.text,
                borderRadius: radius.lg,
                paddingHorizontal: 14,
                paddingTop: 11,
                paddingBottom: 11,
                fontSize: 15,
              }}
            />
            {text.trim() ? (
              <Pressable
                onPress={sendText}
                disabled={sending}
                accessibilityLabel="Enviar"
                style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}
              >
                {sending ? <ActivityIndicator color={colors.onAccent} /> : <Icon name="send" size={18} color={colors.onAccent} />}
              </Pressable>
            ) : (
              <AudioRecorderButton disabled={sending} onRecorded={sendFile} />
            )}
          </Row>
        </View>
      </Screen>

      <Sheet visible={attachOpen} onClose={() => setAttachOpen(false)} title="Enviar anexo">
        <ListItem icon="image" title="Foto ou vídeo da galeria" onPress={async () => sendFile(await pickFromLibrary('all'))} />
        <ListItem icon="camera" title="Tirar foto" onPress={async () => sendFile(await takePhoto())} />
        <ListItem icon="file" title="Documento (PDF, Word, Excel)" onPress={async () => sendFile(await pickDocument())} />
      </Sheet>
    </KeyboardAvoidingView>
  );
}

function AudioRecorderButton({ onRecorded, disabled }: { onRecorded: (f: LocalFile) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        notify('Permissão necessária', 'Autorize o microfone para gravar áudios.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      notifyError(e, 'Não foi possível gravar');
    }
  };

  const stop = async (send: boolean) => {
    if (timer.current) clearInterval(timer.current);
    setRecording(false);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (!send || !uri) return;
      const ext = (uri.split('?')[0].split('.').pop() || 'm4a').toLowerCase();
      const mime = ext === 'webm' ? 'audio/webm' : ext === 'ogg' ? 'audio/ogg' : ext === 'wav' ? 'audio/wav' : ext === '3gp' ? 'audio/3gpp' : 'audio/mp4';
      onRecorded({ uri, name: `audio-${Date.now()}.${ext.length <= 4 ? ext : 'm4a'}`, mimeType: mime });
    } catch (e) {
      notifyError(e, 'Falha ao finalizar a gravação');
    }
  };

  if (recording) {
    return (
      <Row gap={6}>
        <T tone="danger" style={{ fontWeight: '700' }}>
          ● {formatDuration(seconds)}
        </T>
        <Pressable onPress={() => stop(false)} accessibilityLabel="Descartar áudio" style={{ padding: 8 }}>
          <Icon name="trash" color={colors.textSecondary} size={20} />
        </Pressable>
        <Pressable
          onPress={() => stop(true)}
          accessibilityLabel="Enviar áudio"
          style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="send" size={18} color={colors.onAccent} />
        </Pressable>
      </Row>
    );
  }
  return (
    <Pressable
      onPress={start}
      disabled={disabled}
      accessibilityLabel="Gravar áudio"
      style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name="mic" size={20} color={colors.text} />
    </Pressable>
  );
}

function Bubble({ message: m, mine }: { message: Message; mine: boolean }) {
  const { colors } = useTheme();
  const fg = mine ? colors.onAccent : colors.text;
  const url = absoluteUrl(m.attachmentUrl);
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
      <View
        style={{
          maxWidth: '82%',
          backgroundColor: mine ? colors.accent : colors.surfaceElevated,
          borderRadius: 18,
          borderBottomRightRadius: mine ? 4 : 18,
          borderBottomLeftRadius: mine ? 18 : 4,
          padding: m.type === 'IMAGE' || m.type === 'VIDEO' ? 4 : 12,
          gap: 6,
          borderWidth: mine ? 0 : 1,
          borderColor: colors.border,
        }}
      >
        {m.isQuestion ? (
          <View style={{ paddingHorizontal: m.type === 'IMAGE' ? 8 : 0 }}>
            <Badge label="DÚVIDA" tone={mine ? 'neutral' : 'warning'} icon="help" />
          </View>
        ) : null}
        {m.type === 'IMAGE' && url ? (
          <Pressable onPress={() => Linking.openURL(url)}>
            <Image source={{ uri: url }} style={{ width: 220, height: 220, borderRadius: 14 }} contentFit="cover" />
          </Pressable>
        ) : null}
        {m.type === 'VIDEO' && url ? (
          <View style={{ width: 240 }}>
            <VideoPlayer uri={url} height={180} />
          </View>
        ) : null}
        {m.type === 'AUDIO' && url ? <AudioPlayerBubble uri={url} tint={fg} /> : null}
        {m.type === 'FILE' && url ? (
          <Pressable onPress={() => Linking.openURL(url)}>
            <Row gap={8}>
              <Icon name="file" color={fg} />
              <T style={{ color: fg, textDecorationLine: 'underline', flexShrink: 1 }} numberOfLines={2}>
                {m.attachmentName ?? 'Arquivo'}
              </T>
            </Row>
          </Pressable>
        ) : null}
        {m.content ? <T style={{ color: fg, paddingHorizontal: m.type === 'IMAGE' || m.type === 'VIDEO' ? 8 : 0 }}>{m.content}</T> : null}
        <Row gap={4} style={{ alignSelf: 'flex-end', paddingHorizontal: m.type === 'IMAGE' || m.type === 'VIDEO' ? 8 : 0, paddingBottom: m.type === 'IMAGE' || m.type === 'VIDEO' ? 4 : 0 }}>
          <T variant="small" style={{ color: fg, opacity: 0.6, fontSize: 11 }}>
            {fmtTime(m.createdAt)}
          </T>
          {mine ? <Icon name={m.readAt ? 'check-circle' : 'check'} size={12} color={fg} /> : null}
        </Row>
      </View>
    </View>
  );
}
