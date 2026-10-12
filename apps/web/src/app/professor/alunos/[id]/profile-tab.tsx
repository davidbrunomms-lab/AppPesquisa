'use client';

import { SEX_LABELS, TRAINING_GOAL_LABELS, TRAINING_LEVEL_LABELS, formatDuration, type StudentDetail } from '@personalpro/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Phone, Save, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { BarsChart } from '@/components/charts';
import { useToast } from '@/components/toast';
import { Button, Card, CardBody, CardHeader, Input, Select } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { fmtDate, fmtDayKey, fmtNumber, toInputDate } from '@/lib/format';

export function ProfileTab({ student: s, link }: { student: StudentDetail; link?: StudentDetail['trainers'][number] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({
    name: s.name,
    phone: s.phone ?? '',
    birthDate: toInputDate(s.birthDate),
    sex: s.sex ?? '',
    heightCm: s.heightCm?.toString() ?? '',
    initialWeightKg: s.initialWeightKg?.toString() ?? '',
    currentWeightKg: s.currentWeightKg?.toString() ?? '',
    goal: s.goal ?? '',
    level: s.level,
    weeklyFrequency: String(s.weeklyFrequency),
    gymName: s.gym?.name ?? '',
    gymCity: s.gym?.city ?? '',
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const n = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(',', '.')));

  const save = useMutation({
    mutationFn: () =>
      api(`/students/${s.id}`, {
        method: 'PATCH',
        body: {
          name: f.name.trim(),
          phone: f.phone || undefined,
          birthDate: f.birthDate ? new Date(`${f.birthDate}T12:00:00`).toISOString() : undefined,
          sex: f.sex || undefined,
          heightCm: n(f.heightCm),
          initialWeightKg: n(f.initialWeightKg),
          currentWeightKg: n(f.currentWeightKg),
          goal: f.goal || undefined,
          level: f.level,
          weeklyFrequency: n(f.weeklyFrequency),
          gymName: f.gymName || undefined,
          gymCity: f.gymCity || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Perfil atualizado');
      qc.invalidateQueries({ queryKey: ['student', s.id] });
      qc.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (e) => toast.error('Não foi possível salvar', errorMessage(e)),
  });

  const setLink = useMutation({
    mutationFn: (status: 'ACTIVE' | 'INACTIVE') => api(`/students/${s.id}/link`, { method: 'PATCH', body: { status } }),
    onSuccess: (_, status) => {
      toast.success(status === 'ACTIVE' ? 'Aluno reativado' : 'Aluno inativado');
      qc.invalidateQueries({ queryKey: ['student', s.id] });
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['dashboard-trainer'] });
    },
    onError: (e) => toast.error('Não foi possível alterar o status', errorMessage(e)),
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader title="Dados do aluno" subtitle="Informações usadas em treinos, metas e relatórios" />
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <Input label="Nome" value={f.name} onChange={set('name')} wrapperClassName="sm:col-span-2" required />
            <Input label="Telefone" value={f.phone} onChange={set('phone')} />
            <Input label="Nascimento" type="date" value={f.birthDate} onChange={set('birthDate')} />
            <Select label="Sexo" value={f.sex} onChange={set('sex')} placeholder="—" options={Object.entries(SEX_LABELS).map(([value, label]) => ({ value, label }))} />
            <Input label="Altura (cm)" inputMode="numeric" value={f.heightCm} onChange={set('heightCm')} />
            <Input label="Peso inicial (kg)" inputMode="decimal" value={f.initialWeightKg} onChange={set('initialWeightKg')} />
            <Input label="Peso atual (kg)" inputMode="decimal" value={f.currentWeightKg} onChange={set('currentWeightKg')} />
            <Select label="Objetivo" value={f.goal} onChange={set('goal')} placeholder="—" options={Object.entries(TRAINING_GOAL_LABELS).map(([value, label]) => ({ value, label }))} />
            <Select label="Nível" value={f.level} onChange={set('level')} options={Object.entries(TRAINING_LEVEL_LABELS).map(([value, label]) => ({ value, label }))} />
            <Input label="Frequência semanal" type="number" min={1} max={7} value={f.weeklyFrequency} onChange={set('weeklyFrequency')} />
            <Input label="Academia" value={f.gymName} onChange={set('gymName')} />
            <Input label="Cidade" value={f.gymCity} onChange={set('gymCity')} />
            <div className="sm:col-span-2 lg:col-span-3">
              <Button type="submit" loading={save.isPending}>
                <Save className="size-4" /> Salvar alterações
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Contato e vínculo" />
          <CardBody className="space-y-3 text-sm">
            <p className="flex items-center gap-2 text-muted">
              <Mail className="size-4" /> <span className="truncate text-fg">{s.email}</span>
            </p>
            <p className="flex items-center gap-2 text-muted">
              <Phone className="size-4" /> <span className="text-fg">{s.phone ?? '—'}</span>
            </p>
            {link && <p className="text-muted">Aluno desde {fmtDate(link.startedAt)}</p>}
            {link && (
              <div className="pt-1">
                {link.status === 'INACTIVE' ? (
                  <Button variant="secondary" loading={setLink.isPending} onClick={() => setLink.mutate('ACTIVE')}>
                    <UserCheck className="size-4" /> Reativar aluno
                  </Button>
                ) : (
                  <Button variant="danger" loading={setLink.isPending} onClick={() => confirm(`Inativar ${s.name}? Ele deixa de ocupar vaga no seu plano.`) && setLink.mutate('INACTIVE')}>
                    <UserX className="size-4" /> Inativar aluno
                  </Button>
                )}
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Frequência" subtitle="treinos por semana" />
          <CardBody>
            <BarsChart data={s.frequencySeries} xKey="weekStart" series={[{ key: 'count', label: 'Treinos' }]} xFormatter={fmtDayKey} height={150} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-surface-2 p-2">
                <p className="text-muted">Média/sem</p>
                <p className="tabular font-semibold">{fmtNumber(s.stats.weeklyAverage)}</p>
              </div>
              <div className="rounded-xl bg-surface-2 p-2">
                <p className="text-muted">Duração</p>
                <p className="tabular font-semibold">{s.stats.averageDurationSeconds ? formatDuration(s.stats.averageDurationSeconds) : '—'}</p>
              </div>
              <div className="rounded-xl bg-surface-2 p-2">
                <p className="text-muted">Metas ativas</p>
                <p className="tabular font-semibold">{s.activeGoals}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
