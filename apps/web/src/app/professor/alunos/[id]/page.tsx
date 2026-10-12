'use client';

import { TRAINING_GOAL_LABELS, TRAINING_LEVEL_LABELS, type StudentDetail } from '@personalpro/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BarChart3, ClipboardList, Dumbbell, FileText, MessageCircle, NotebookPen, Target, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AssessmentsPanel } from '@/components/assessments-panel';
import { ChatView } from '@/components/chat-view';
import { EvolutionPanel } from '@/components/evolution-panel';
import { GoalsPanel } from '@/components/goals-panel';
import { Avatar, Badge, ErrorState, LoadingBlock, Tabs } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { LINK_STATUS_LABELS, linkTone, relativeDays } from '@/lib/format';
import { NotesTab } from './notes-tab';
import { ProfileTab } from './profile-tab';
import { ReportsTab } from './reports-tab';
import { WorkoutsTab } from './workouts-tab';

const TABS = [
  { value: 'perfil', label: 'Perfil', icon: <UserRound className="size-4" /> },
  { value: 'treinos', label: 'Treinos', icon: <Dumbbell className="size-4" /> },
  { value: 'evolucao', label: 'Evolução', icon: <BarChart3 className="size-4" /> },
  { value: 'avaliacoes', label: 'Avaliações', icon: <ClipboardList className="size-4" /> },
  { value: 'metas', label: 'Metas', icon: <Target className="size-4" /> },
  { value: 'anotacoes', label: 'Anotações', icon: <NotebookPen className="size-4" /> },
  { value: 'relatorios', label: 'Relatórios', icon: <FileText className="size-4" /> },
  { value: 'chat', label: 'Chat', icon: <MessageCircle className="size-4" /> },
] as const;
type Tab = (typeof TABS)[number]['value'];

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('perfil');
  const student = useQuery({ queryKey: ['student', id], queryFn: () => api<StudentDetail>(`/students/${id}`) });

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace('#', '') as Tab;
      if (TABS.some((t) => t.value === h)) setTab(h);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  const changeTab = (t: Tab) => {
    setTab(t);
    history.replaceState(null, '', `#${t}`);
  };

  if (student.isLoading) return <LoadingBlock />;
  if (student.isError) return <ErrorState error={student.error} onRetry={() => student.refetch()} />;
  const s = student.data!;
  const link = s.trainers.find((t) => t.trainerId === user?.trainerId);

  return (
    <div>
      <Link href="/professor/alunos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Alunos
      </Link>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar name={s.name} src={s.avatarUrl} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{s.name}</h1>
            {link && <Badge tone={linkTone(link.status)}>{LINK_STATUS_LABELS[link.status]}</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {s.goal ? TRAINING_GOAL_LABELS[s.goal] : 'Sem objetivo definido'} · {TRAINING_LEVEL_LABELS[s.level]} · {s.weeklyFrequency}x por semana
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:flex sm:gap-6 sm:text-right">
          <HeaderStat label="Treinos" value={String(s.totalWorkouts)} />
          <HeaderStat label="Este mês" value={String(s.stats.monthCount)} />
          <HeaderStat label="Último treino" value={relativeDays(s.lastWorkoutAt)} />
        </div>
      </div>

      <Tabs tabs={TABS.map((t) => ({ ...t }))} value={tab} onChange={changeTab} className="mb-5" />

      {tab === 'perfil' && <ProfileTab student={s} link={link} />}
      {tab === 'treinos' && <WorkoutsTab studentId={s.id} />}
      {tab === 'evolucao' && <EvolutionPanel studentId={s.id} />}
      {tab === 'avaliacoes' && <AssessmentsPanel studentId={s.id} role="TRAINER" />}
      {tab === 'metas' && <GoalsPanel studentId={s.id} editable />}
      {tab === 'anotacoes' && <NotesTab studentId={s.id} />}
      {tab === 'relatorios' && <ReportsTab studentId={s.id} />}
      {tab === 'chat' && (link ? <ChatView initialId={link.linkId} single height="calc(100dvh - 22rem)" /> : <p className="text-sm text-muted">Sem vínculo ativo para conversar.</p>)}
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2 sm:bg-transparent sm:p-0">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="tabular text-sm font-semibold sm:text-base">{value}</p>
    </div>
  );
}
