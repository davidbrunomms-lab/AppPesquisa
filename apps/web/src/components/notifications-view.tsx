'use client';

import type { AppNotification, NotificationType } from '@personalpro/shared';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarDays, CheckCheck, ClipboardList, Dumbbell, FileText, MessageCircle, Sparkles, Target, Trophy, TriangleAlert } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Segmented } from './ui';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime } from '@/lib/format';
import { useToast } from './toast';
import { useState } from 'react';

const ICONS: Partial<Record<NotificationType, React.ReactNode>> = {
  WORKOUT_REMINDER: <Dumbbell />,
  WORKOUT_UPDATED: <Dumbbell />,
  INACTIVITY: <TriangleAlert />,
  MILESTONE: <Trophy />,
  PERSONAL_RECORD: <Trophy />,
  APPOINTMENT: <CalendarDays />,
  MESSAGE: <MessageCircle />,
  ASSESSMENT: <ClipboardList />,
  GOAL: <Target />,
  AI_SUGGESTION: <Sparkles />,
  WEEKLY_REPORT: <FileText />,
};

interface Page {
  items: AppNotification[];
  total: number;
  unread: number;
  page: number;
  pageSize: number;
}

export function NotificationsView() {
  const qc = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const q = useInfiniteQuery({
    queryKey: ['notifications', filter],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Page>('/notifications', { query: { page: pageParam, pageSize: 20, unread: filter === 'unread' ? true : undefined } }),
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['dashboard-student'] });
    qc.invalidateQueries({ queryKey: ['notifications-count'] });
  };
  const readOne = useMutation({ mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }), onSuccess: invalidate });
  const readAll = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Todas marcadas como lidas');
      invalidate();
    },
    onError: (e) => toast.error('Erro', errorMessage(e)),
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = q.data?.pages[0]?.unread ?? 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notificações"
        subtitle={unread ? `${unread} não lida(s)` : 'Tudo em dia'}
        actions={
          <Button variant="secondary" disabled={!unread} loading={readAll.isPending} onClick={() => readAll.mutate()}>
            <CheckCheck className="size-4" /> Marcar todas como lidas
          </Button>
        }
      />
      <Segmented
        className="mb-4"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Todas' },
          { value: 'unread', label: 'Não lidas' },
        ]}
      />
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={<Bell className="size-5" />} title="Nenhuma notificação" description="Lembretes de treino, recordes, agenda e mensagens aparecem aqui." />
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => !n.readAt && readOne.mutate(n.id)}
              className={cn('flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-surface-2/60', !n.readAt && 'bg-accent-soft/40')}
            >
              <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl [&>svg]:size-4', n.readAt ? 'bg-surface-2 text-muted' : 'bg-accent-soft text-accent-ink')}>{ICONS[n.type] ?? <Bell />}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className={cn('truncate text-sm', n.readAt ? 'font-medium' : 'font-semibold')}>{n.title}</span>
                  {!n.readAt && <span className="size-2 shrink-0 rounded-full bg-accent" />}
                </span>
                <span className="mt-0.5 block text-sm text-muted">{n.body}</span>
                <span className="mt-1 block text-[11px] text-subtle">{fmtDateTime(n.createdAt)}</span>
              </span>
            </button>
          ))}
          {q.hasNextPage && (
            <div className="p-3 text-center">
              <Button variant="ghost" size="sm" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
                Carregar mais
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
