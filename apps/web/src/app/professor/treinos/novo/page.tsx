'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { WorkoutBuilder } from '@/components/workout-builder';

export default function NewWorkoutPage() {
  return (
    <div>
      <PageHeader
        back={
          <Link href="/professor/treinos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
            <ArrowLeft className="size-4" /> Treinos
          </Link>
        }
        title="Novo treino"
        subtitle="Monte a ficha com exercícios, séries, cargas e técnicas"
      />
      <WorkoutBuilder />
    </div>
  );
}
