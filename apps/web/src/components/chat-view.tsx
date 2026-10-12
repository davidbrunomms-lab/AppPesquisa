'use client';

import type { Conversation, Message } from '@personalpro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, CheckCheck, FileText, HelpCircle, Loader2, MessageCircle, Paperclip, SendHorizontal } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fmtDate, fmtTime, sameDay } from '@/lib/format';
import { useChatSocket } from '@/lib/socket';
import { useToast } from './toast';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, LoadingBlock } from './ui';

const PAGE = 40;

export function useConversations(enabled = true) {
  return useQuery({ enabled, queryKey: ['conversations'], queryFn: () => api<Conversation[]>('/conversations'), refetchInterval: 60_000 });
}

/**
 * Chat completo (lista + conversa). `initialId` abre uma conversa direto;
 * `single` esconde a lista (ex.: aba de chat no detalhe do aluno).
 */
export function ChatView({ initialId, single, height = 'calc(100dvh - 13rem)' }: { initialId?: string | null; single?: boolean; height?: string }) {
  const conversations = useConversations();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(initialId ?? null);
  const [typingIn, setTypingIn] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenersRef = useRef<{ onMessage?: (m: Message) => void; onRead?: (id: string) => void }>({});

  useEffect(() => {
    if (initialId) setActiveId(initialId);
  }, [initialId]);

  // Abre a primeira conversa automaticamente (aluno com um professor, modo único ou desktop).
  useEffect(() => {
    const data = conversations.data;
    if (activeId || !data?.length) return;
    if (single || data.length === 1 || window.innerWidth >= 1024) setActiveId(data[0].id);
  }, [conversations.data, activeId, single]);

  const { connected, emitTyping } = useChatSocket({
    onMessage: (m) => {
      listenersRef.current.onMessage?.(m);
      qc.setQueryData<Conversation[]>(['conversations'], (prev) =>
        prev?.map((c) => (c.id === m.trainerStudentId ? { ...c, lastMessage: m, unreadCount: m.trainerStudentId === activeId ? 0 : c.unreadCount + 1 } : c)),
      );
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onRead: (e) => listenersRef.current.onRead?.(e.conversationId),
    onTyping: (e) => {
      setTypingIn(e.conversationId);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTypingIn(null), 3000);
    },
  });

  if (conversations.isLoading) return <LoadingBlock />;
  if (conversations.isError) return <ErrorState error={conversations.error} onRetry={() => conversations.refetch()} />;
  const list = conversations.data ?? [];
  const active = list.find((c) => c.id === activeId) ?? null;

  if (list.length === 0) {
    return (
      <Card>
        <EmptyState icon={<MessageCircle className="size-5" />} title="Nenhuma conversa ainda" description="As conversas aparecem quando há vínculo ativo entre professor e aluno." />
      </Card>
    );
  }

  return (
    <Card className="flex overflow-hidden" style={{ height, minHeight: 420 }}>
      {!single && (
        <aside className={cn('w-full shrink-0 flex-col border-r border-border lg:flex lg:w-80', active ? 'hidden' : 'flex')}>
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <p className="text-sm font-semibold">Conversas</p>
            <span className={cn('flex items-center gap-1.5 text-[11px]', connected ? 'text-success' : 'text-subtle')}>
              <span className={cn('size-1.5 rounded-full', connected ? 'bg-success' : 'bg-subtle')} />
              {connected ? 'online' : 'conectando'}
            </span>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {list.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2', c.id === activeId && 'bg-surface-2')}
                >
                  <Avatar name={c.participant.name} src={c.participant.avatarUrl} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{c.participant.name}</p>
                      {c.lastMessage && <span className="shrink-0 text-[11px] text-subtle">{fmtTime(c.lastMessage.createdAt)}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-muted">
                        {typingIn === c.id ? <span className="text-accent-ink">digitando…</span> : previewText(c.lastMessage)}
                      </p>
                      {c.unreadCount > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-fg">{c.unreadCount}</span>}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
      <section className={cn('min-w-0 flex-1 flex-col', active || single ? 'flex' : 'hidden lg:flex')}>
        {active ? (
          <Thread
            key={active.id}
            conversation={active}
            onBack={single ? undefined : () => setActiveId(null)}
            typing={typingIn === active.id}
            emitTyping={() => emitTyping(active.id)}
            register={(l) => (listenersRef.current = l)}
          />
        ) : (
          <EmptyState className="m-auto" icon={<MessageCircle className="size-5" />} title="Selecione uma conversa" />
        )}
      </section>
    </Card>
  );
}

function previewText(m: Message | null) {
  if (!m) return 'Sem mensagens';
  if (m.type === 'IMAGE') return '📷 Foto';
  if (m.type === 'VIDEO') return '🎬 Vídeo';
  if (m.type === 'AUDIO') return '🎤 Áudio';
  if (m.type === 'FILE') return `📎 ${m.attachmentName ?? 'Arquivo'}`;
  return m.content ?? '';
}

function Thread({
  conversation,
  onBack,
  typing,
  emitTyping,
  register,
}: {
  conversation: Conversation;
  onBack?: () => void;
  typing: boolean;
  emitTyping: () => void;
  register: (l: { onMessage?: (m: Message) => void; onRead?: (id: string) => void }) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stickBottom = useRef(true);
  const lastTyping = useRef(0);

  const initial = useQuery({
    queryKey: ['messages', conversation.id],
    queryFn: () => api<Message[]>(`/conversations/${conversation.id}/messages`, { query: { limit: PAGE } }),
    staleTime: 0,
  });

  const markRead = useCallback(() => {
    api(`/conversations/${conversation.id}/read`, { method: 'POST' })
      .then(() => {
        qc.setQueryData<Conversation[]>(['conversations'], (prev) => prev?.map((c) => (c.id === conversation.id ? { ...c, unreadCount: 0 } : c)));
        qc.invalidateQueries({ queryKey: ['dashboard-trainer'] });
        qc.invalidateQueries({ queryKey: ['dashboard-student'] });
      })
      .catch(() => undefined);
  }, [conversation.id, qc]);

  useEffect(() => {
    if (!initial.data) return;
    setMessages(sortAsc(initial.data));
    setHasMore(initial.data.length >= PAGE);
    stickBottom.current = true;
    markRead();
  }, [initial.data, markRead]);

  useEffect(() => {
    register({
      onMessage: (m) => {
        if (m.trainerStudentId !== conversation.id) return;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.senderId !== user?.id) markRead();
      },
      onRead: (id) => {
        if (id !== conversation.id) return;
        setMessages((prev) => prev.map((x) => (x.senderId === user?.id && !x.readAt ? { ...x, readAt: new Date().toISOString() } : x)));
      },
    });
    return () => register({});
  }, [conversation.id, register, user?.id, markRead]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const send = useMutation({
    mutationFn: (content: string) => api<Message>(`/conversations/${conversation.id}/messages`, { method: 'POST', body: { type: 'TEXT', content } }),
    onSuccess: (m) => {
      stickBottom.current = true;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e, content) => {
      setText(content);
      toast.error('Mensagem não enviada', errorMessage(e));
    },
  });

  const attach = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      if (text.trim()) form.append('content', text.trim());
      return api<Message>(`/conversations/${conversation.id}/attachments`, { method: 'POST', form });
    },
    onSuccess: (m) => {
      setText('');
      stickBottom.current = true;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e) => toast.error('Falha ao enviar anexo', errorMessage(e)),
  });

  async function loadMore() {
    if (!messages.length) return;
    setLoadingMore(true);
    try {
      const older = await api<Message[]>(`/conversations/${conversation.id}/messages`, { query: { limit: PAGE, before: messages[0].createdAt } });
      stickBottom.current = false;
      const el = scroller.current;
      const prevHeight = el?.scrollHeight ?? 0;
      setMessages((prev) => sortAsc([...older.filter((o) => !prev.some((p) => p.id === o.id)), ...prev]));
      setHasMore(older.length >= PAGE);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } finally {
      setLoadingMore(false);
    }
  }

  const submit = () => {
    const content = text.trim();
    if (!content || send.isPending) return;
    setText('');
    send.mutate(content);
  };

  const groups = useMemo(() => {
    const out: { day: string; items: Message[] }[] = [];
    for (const m of messages) {
      const d = new Date(m.createdAt);
      const last = out[out.length - 1];
      if (last && sameDay(new Date(last.items[0].createdAt), d)) last.items.push(m);
      else out.push({ day: dayLabel(d), items: [m] });
    }
    return out;
  }, [messages]);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-3 sm:px-4">
        {onBack && (
          <button onClick={onBack} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 lg:hidden" aria-label="Voltar">
            <ArrowLeft className="size-4" />
          </button>
        )}
        <Avatar name={conversation.participant.name} src={conversation.participant.avatarUrl} size={34} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{conversation.participant.name}</p>
          <p className="text-[11px] text-muted">{typing ? <span className="text-accent-ink">digitando…</span> : user?.role === 'TRAINER' ? 'Aluno' : 'Seu personal'}</p>
        </div>
      </header>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-5"
      >
        {initial.isLoading && <LoadingBlock />}
        {hasMore && (
          <div className="text-center">
            <Button size="sm" variant="ghost" loading={loadingMore} onClick={loadMore}>
              Carregar mensagens anteriores
            </Button>
          </div>
        )}
        {!initial.isLoading && messages.length === 0 && <p className="py-10 text-center text-sm text-muted">Envie a primeira mensagem 👋</p>}
        {groups.map((g) => (
          <div key={g.day + g.items[0].id} className="space-y-1.5">
            <p className="py-1 text-center text-[11px] font-medium text-subtle">{g.day}</p>
            {g.items.map((m) => (
              <Bubble key={m.id} m={m} mine={m.senderId === user?.id} />
            ))}
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-border p-2.5 sm:p-3">
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xlsx,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) attach.mutate(f);
              e.target.value = '';
            }}
          />
          <Button variant="ghost" size="icon" aria-label="Anexar arquivo" title="Foto, vídeo, áudio ou arquivo" onClick={() => fileRef.current?.click()} disabled={attach.isPending}>
            {attach.isPending ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
          </Button>
          <textarea
            value={text}
            rows={1}
            onChange={(e) => {
              setText(e.target.value);
              if (Date.now() - lastTyping.current > 2000) {
                lastTyping.current = Date.now();
                emitTyping();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Escreva uma mensagem…"
            className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none placeholder:text-subtle focus:border-accent/70"
          />
          <Button size="icon" className="size-10 rounded-xl" aria-label="Enviar" onClick={submit} disabled={!text.trim() || send.isPending}>
            <SendHorizontal className="size-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

const sortAsc = (list: Message[]) => [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

function dayLabel(d: Date) {
  const today = new Date();
  if (sameDay(d, today)) return 'Hoje';
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (sameDay(d, y)) return 'Ontem';
  return fmtDate(d);
}

function Bubble({ m, mine }: { m: Message; mine: boolean }) {
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm sm:max-w-[70%]',
          mine ? 'rounded-br-md bg-accent text-accent-fg' : 'rounded-bl-md border border-border bg-surface-2',
        )}
      >
        {m.isQuestion && (
          <Badge tone={mine ? 'default' : 'warning'} className={cn('mb-1', mine && 'bg-black/15 text-accent-fg')}>
            <HelpCircle className="size-3" /> Dúvida
          </Badge>
        )}
        {m.attachmentUrl && <Attachment m={m} mine={mine} />}
        {m.content && <p className="break-words whitespace-pre-wrap">{m.content}</p>}
        <p className={cn('mt-0.5 flex items-center justify-end gap-1 text-[10px]', mine ? 'text-accent-fg/70' : 'text-subtle')}>
          {fmtTime(m.createdAt)}
          {mine && (m.readAt ? <CheckCheck className="size-3" /> : <Check className="size-3" />)}
        </p>
      </div>
    </div>
  );
}

function Attachment({ m, mine }: { m: Message; mine: boolean }) {
  const url = m.attachmentUrl!;
  if (m.type === 'IMAGE')
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mb-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={m.attachmentName ?? 'Imagem'} className="max-h-72 rounded-xl object-cover" />
      </a>
    );
  if (m.type === 'VIDEO') return <video src={url} controls className="mb-1 max-h-72 rounded-xl" />;
  if (m.type === 'AUDIO') return <audio src={url} controls className="mb-1 w-64 max-w-full" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className={cn('mb-1 flex items-center gap-2 rounded-xl px-3 py-2', mine ? 'bg-black/10' : 'bg-surface-3')}>
      <FileText className="size-4 shrink-0" />
      <span className="truncate underline-offset-2 hover:underline">{m.attachmentName ?? 'Arquivo'}</span>
    </a>
  );
}
