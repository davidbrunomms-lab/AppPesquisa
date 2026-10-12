'use client';

import type { Workout } from '@personalpro/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ErrorState, LoadingBlock, PageHeader } from '@/components/ui';
import { WorkoutBuilder } from '@/components/workout-builder';
import { api } from '@/lib/api';

export default function EditWorkoutPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ['workout', id], queryFn: () => api<Workout>(`/workouts/${id}`), staleTime: 0 });
  return (
    <div>
      <PageHeader
        back={
          <Link href="/professor/treinos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
            <ArrowLeft className="size-4" /> Treinos
          </Link>
        }
        title={q.data ? `Editar ${q.data.label ? `treino ${q.data.label}` : 'treino'}` : 'Editar treino'}
        subtitle="Alterações são aplicadas a todos os alunos com este treino"
      />
      {q.isLoading && <LoadingBlock />}
      {q.isError && <ErrorState error={q.error} />}
      {q.data && <WorkoutBuilder key={q.data.id} workout={q.data} />}
    </div>
  );
}
