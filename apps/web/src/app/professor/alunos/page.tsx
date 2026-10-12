'use client';

import {
  TRAINING_GOAL_LABELS,
  TRAINING_LEVEL_LABELS,
  type LinkStatus,
  type StudentListItem,
  type TrainingGoal,
  type TrainingLevel,
} from '@personalpro/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Search, SlidersHorizontal, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { DeltaPill } from '@/components/evolution-panel';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, LoadingBlock, PageHeader, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { LINK_STATUS_LABELS, linkTone, relativeDays } from '@/lib/format';
import { AddStudentModal } from './add-student-modal';

export default function StudentsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <StudentsInner />
    </Suspense>
  );
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function StudentsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LinkStatus | ''>('');
  const [goal, setGoal] = useState<TrainingGoal | ''>('');
  const [level, setLevel] = useState<TrainingLevel | ''>('');
  const [inactiveDays, setInactiveDays] = useState(params.get('inativos') ?? '');
  const [sort, setSort] = useState('name');
  const [showFilters, setShowFilters] = useState(!!params.get('inativos'));
  const [addOpen, setAddOpen] = useState(params.get('novo') === '1');
  const q = useDebounced(search);

  const students = useQuery({
    queryKey: ['students', { q, status, goal, level, inactiveDays, sort }],
    queryFn: () => api<StudentListItem[]>('/students', { query: { search: q, status, goal, level, inactiveDays, sort } }),
    placeholderData: (prev) => prev,
  });
  const activeFilters = [status, goal, level, inactiveDays].filter(Boolean).length;

  return (
    <div>
      <PageHeader
        title="Alunos"
        subtitle={students.data ? `${students.data.length} aluno(s) encontrados` : 'Gerencie seus alunos'}
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="size-4" /> Adicionar aluno
          </Button>
        }
      />

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail" className="pl-10" aria-label="Buscar aluno" />
        </div>
        <Button variant="secondary" className="h-11" onClick={() => setShowFilters((s) => !s)}>
          <SlidersHorizontal className="size-4" /> <span className="hidden sm:inline">Filtros</span>
          {activeFilters > 0 && <span className="grid size-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-fg">{activeFilters}</span>}
        </Button>
      </div>

      {showFilters && (
        <Card className="mb-4 grid grid-cols-2 gap-3 p-4 lg:grid-cols-5">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as LinkStatus | '')}
            placeholder="Todos"
            options={(['ACTIVE', 'PENDING', 'INACTIVE'] as LinkStatus[]).map((s) => ({ value: s, label: LINK_STATUS_LABELS[s] }))}
          />
          <Select
            label="Objetivo"
            value={goal}
            onChange={(e) => setGoal(e.target.value as TrainingGoal | '')}
            placeholder="Todos"
            options={Object.entries(TRAINING_GOAL_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Select
            label="Nível"
            value={level}
            onChange={(e) => setLevel(e.target.value as TrainingLevel | '')}
            placeholder="Todos"
            options={Object.entries(TRAINING_LEVEL_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Select
            label="Sem treinar há"
            value={inactiveDays}
            onChange={(e) => setInactiveDays(e.target.value)}
            placeholder="Qualquer"
            options={[3, 7, 14, 30].map((n) => ({ value: String(n), label: `${n}+ dias` }))}
          />
          <Select
            label="Ordenar por"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            options={[
              { value: 'name', label: 'Nome' },
              { value: 'lastWorkout', label: 'Último treino' },
              { value: 'startedAt', label: 'Data de início' },
            ]}
            wrapperClassName="col-span-2 lg:col-span-1"
          />
          {activeFilters > 0 && (
            <button
              type="button"
              className="col-span-2 justify-self-start text-xs font-medium text-muted hover:text-fg lg:col-span-5"
              onClick={() => {
                setStatus('');
                setGoal('');
                setLevel('');
                setInactiveDays('');
              }}
            >
              Limpar filtros
            </button>
          )}
        </Card>
      )}

      {students.isLoading ? (
        <LoadingBlock />
      ) : students.isError ? (
        <ErrorState error={students.error} onRetry={() => students.refetch()} />
      ) : students.data!.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="size-5" />}
            title={q || activeFilters ? 'Nenhum aluno encontrado' : 'Você ainda não tem alunos'}
            description={q || activeFilters ? 'Ajuste a busca ou os filtros.' : 'Cadastre manualmente ou envie um convite por WhatsApp, e-mail ou QR Code.'}
            action={
              !q &&
              !activeFilters && (
                <Button onClick={() => setAddOpen(true)}>
                  <UserPlus className="size-4" /> Adicionar aluno
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_1.2fr_1fr_1fr_0.9fr_1fr_20px] gap-4 border-b border-border px-5 py-3 text-xs font-medium text-muted lg:grid">
            <span>Aluno</span>
            <span>Objetivo</span>
            <span>Último treino</span>
            <span>Freq. semanal</span>
            <span>Status</span>
            <span>Evolução de peso</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {students.data!.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/professor/alunos/${s.id}`}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3.5 transition hover:bg-surface-2/60 lg:grid-cols-[minmax(0,2.2fr)_1.2fr_1fr_1fr_0.9fr_1fr_20px] lg:gap-4 lg:px-5"
                >
                  <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
                    <Avatar name={s.name} src={s.avatarUrl} size={42} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{s.name}</p>
                      <p className="truncate text-xs text-muted">
                        <span className="lg:hidden">{s.goal ? TRAINING_GOAL_LABELS[s.goal] : 'Sem objetivo'} · </span>
                        {TRAINING_LEVEL_LABELS[s.level]}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-subtle lg:hidden" />
                  <span className="hidden truncate text-sm lg:block">{s.goal ? TRAINING_GOAL_LABELS[s.goal] : '—'}</span>
                  <span className={cn('hidden text-sm lg:block', (s.daysSinceLastWorkout ?? 99) >= 7 ? 'text-warning' : 'text-muted')}>{relativeDays(s.lastWorkoutAt)}</span>
                  <span className="hidden text-sm lg:block">
                    <span className="tabular font-semibold">{s.workoutsThisWeek}</span>
                    <span className="text-muted">/{s.weeklyFrequency}x</span>
                  </span>
                  <span className="hidden lg:block">
                    <Badge tone={linkTone(s.status)}>{LINK_STATUS_LABELS[s.status]}</Badge>
                  </span>
                  <span className="hidden lg:block">
                    <DeltaPill evo={s.weightEvolution} unit="kg" lowerIsBetter={s.goal === 'WEIGHT_LOSS' || s.goal === 'DEFINITION'} />
                  </span>
                  <ChevronRight className="hidden size-4 text-subtle lg:block" />
                  {/* Linha extra no mobile */}
                  <div className="col-span-3 flex flex-wrap items-center gap-x-3 gap-y-1 pl-[54px] text-xs text-muted lg:hidden">
                    <Badge tone={linkTone(s.status)}>{LINK_STATUS_LABELS[s.status]}</Badge>
                    <span className={cn((s.daysSinceLastWorkout ?? 99) >= 7 && 'text-warning')}>Último: {relativeDays(s.lastWorkoutAt)}</span>
                    <span>
                      Semana: {s.workoutsThisWeek}/{s.weeklyFrequency}x
                    </span>
                    <DeltaPill evo={s.weightEvolution} unit="kg" lowerIsBetter={s.goal === 'WEIGHT_LOSS' || s.goal === 'DEFINITION'} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <AddStudentModal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          if (params.get('novo')) router.replace('/professor/alunos');
        }}
      />
    </div>
  );
}
