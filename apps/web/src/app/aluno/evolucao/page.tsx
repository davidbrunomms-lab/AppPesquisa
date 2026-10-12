'use client';

import { BarChart3, ClipboardList, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AssessmentsPanel } from '@/components/assessments-panel';
import { EvolutionPanel } from '@/components/evolution-panel';
import { GoalsPanel } from '@/components/goals-panel';
import { PageHeader, Tabs } from '@/components/ui';

type Tab = 'graficos' | 'metas' | 'avaliacoes';

export default function StudentEvolutionPage() {
  const [tab, setTab] = useState<Tab>('graficos');
  useEffect(() => {
    const h = window.location.hash.replace('#', '');
    if (h === 'metas' || h === 'avaliacoes') setTab(h);
  }, []);
  return (
    <div>
      <PageHeader title="Minha evolução" subtitle="Peso, medidas, cargas, metas e avaliações físicas" />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={(t) => {
          setTab(t);
          history.replaceState(null, '', `#${t}`);
        }}
        tabs={[
          { value: 'graficos', label: 'Gráficos', icon: <BarChart3 className="size-4" /> },
          { value: 'metas', label: 'Metas', icon: <Target className="size-4" /> },
          { value: 'avaliacoes', label: 'Avaliações', icon: <ClipboardList className="size-4" /> },
        ]}
      />
      {tab === 'graficos' && <EvolutionPanel />}
      {tab === 'metas' && <GoalsPanel />}
      {tab === 'avaliacoes' && <AssessmentsPanel role="STUDENT" />}
    </div>
  );
}
