'use client';

import type { TrainerDashboard } from '@personalpro/shared';
import { useQuery } from '@tanstack/react-query';
import { Bell, BookOpen, CalendarDays, Dumbbell, LayoutDashboard, MessageCircle, Sparkles, UserRound, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppShell, HeaderIconLink, type NavItem } from '@/components/app-shell';
import { api } from '@/lib/api';
import { useRoleGuard } from '@/lib/auth';

export default function TrainerLayout({ children }: { children: ReactNode }) {
  const { allowed } = useRoleGuard('TRAINER');
  const dash = useQuery({
    enabled: allowed,
    queryKey: ['dashboard-trainer'],
    queryFn: () => api<TrainerDashboard>('/dashboard/trainer'),
    refetchInterval: 60_000,
  });
  const notif = useQuery({
    enabled: allowed,
    queryKey: ['notifications-count'],
    queryFn: () => api<{ unread: number }>('/notifications', { query: { unread: true, pageSize: 1 } }),
    refetchInterval: 60_000,
  });
  const unreadNotifications = notif.data?.unread ?? 0;
  const unread = dash.data?.unreadMessages ?? 0;
  const ai = dash.data?.pendingAiSuggestions ?? 0;

  const nav: NavItem[] = [
    { href: '/professor', label: 'Dashboard', icon: <LayoutDashboard />, primary: true, exact: true },
    { href: '/professor/alunos', label: 'Alunos', icon: <Users />, primary: true },
    { href: '/professor/treinos', label: 'Treinos', icon: <Dumbbell />, primary: true },
    { href: '/professor/exercicios', label: 'Exercícios', icon: <BookOpen /> },
    { href: '/professor/agenda', label: 'Agenda', icon: <CalendarDays />, primary: true },
    { href: '/professor/mensagens', label: 'Mensagens', icon: <MessageCircle />, badge: unread },
    { href: '/professor/ia', label: 'IA', icon: <Sparkles />, badge: ai },
    { href: '/professor/notificacoes', label: 'Notificações', icon: <Bell />, badge: unreadNotifications },
    { href: '/professor/perfil', label: 'Perfil', icon: <UserRound />, primary: true },
  ];

  return (
    <AppShell
      nav={nav}
      allowed={allowed}
      areaLabel="Área do professor"
      headerActions={
        <>
          <HeaderIconLink href="/professor/exercicios" label="Biblioteca de exercícios" icon={<BookOpen />} />
          <HeaderIconLink href="/professor/ia" label="Sugestões da IA" icon={<Sparkles />} badge={ai} />
          <HeaderIconLink href="/professor/mensagens" label="Mensagens" icon={<MessageCircle />} badge={unread} />
          <HeaderIconLink href="/professor/notificacoes" label="Notificações" icon={<Bell />} badge={unreadNotifications} />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
