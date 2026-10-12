'use client';

import type { StudentDashboard } from '@personalpro/shared';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarDays, Dumbbell, Home, LineChart, MessageCircle, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppShell, HeaderIconLink, type NavItem } from '@/components/app-shell';
import { useConversations } from '@/components/chat-view';
import { api } from '@/lib/api';
import { useRoleGuard } from '@/lib/auth';

export default function StudentLayout({ children }: { children: ReactNode }) {
  const { allowed } = useRoleGuard('STUDENT');
  const dash = useQuery({
    enabled: allowed,
    queryKey: ['dashboard-student'],
    queryFn: () => api<StudentDashboard>('/dashboard/student'),
    refetchInterval: 60_000,
  });
  return (
    <AppShell
      nav={useNav(dash.data?.unreadNotifications ?? 0, allowed)}
      allowed={allowed}
      areaLabel="Área do aluno"
      headerActions={<Header unreadNotifications={dash.data?.unreadNotifications ?? 0} enabled={allowed} />}
    >
      {children}
    </AppShell>
  );
}

function useUnreadMessages(enabled: boolean) {
  const c = useConversations(enabled);
  return enabled ? (c.data ?? []).reduce((a, x) => a + x.unreadCount, 0) : 0;
}

function useNav(notifications: number, enabled: boolean): NavItem[] {
  const unread = useUnreadMessages(enabled);
  return [
    { href: '/aluno', label: 'Início', icon: <Home />, primary: true, exact: true },
    { href: '/aluno/treinos', label: 'Treinos', icon: <Dumbbell />, primary: true },
    { href: '/aluno/evolucao', label: 'Evolução', icon: <LineChart />, primary: true },
    { href: '/aluno/agenda', label: 'Agenda', icon: <CalendarDays />, primary: true },
    { href: '/aluno/mensagens', label: 'Mensagens', icon: <MessageCircle />, badge: unread },
    { href: '/aluno/notificacoes', label: 'Notificações', icon: <Bell />, badge: notifications },
    { href: '/aluno/perfil', label: 'Perfil', icon: <UserRound />, primary: true },
  ];
}

function Header({ unreadNotifications, enabled }: { unreadNotifications: number; enabled: boolean }) {
  const unread = useUnreadMessages(enabled);
  return (
    <>
      <HeaderIconLink href="/aluno/mensagens" label="Mensagens" icon={<MessageCircle />} badge={unread} />
      <HeaderIconLink href="/aluno/notificacoes" label="Notificações" icon={<Bell />} badge={unreadNotifications} />
    </>
  );
}
