'use client';

import { SEX_LABELS, TRAINING_GOAL_LABELS, TRAINING_LEVEL_LABELS, type StudentDetail } from '@personalpro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Save, UserPlus, UserRound } from 'lucide-react';
import { useRef, useState } from 'react';
import { PrivacyCard, SecurityCard } from '@/components/account-section';
import { useToast } from '@/components/toast';
import { Avatar, Badge, Button, Card, CardBody, CardHeader, ErrorState, Input, LoadingBlock, PageHeader, Select } from '@/components/ui';
import { api, errorMessage, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, LINK_STATUS_LABELS, linkTone, toInputDate } from '@/lib/format';

export default function StudentProfilePage() {
  const me = useQuery({ queryKey: ['student', 'me'], queryFn: () => api<StudentDetail>('/students/me') });
  return (
    <div>
      <PageHeader title="Perfil" subtitle="Seus dados, segurança e privacidade" />
      {me.isLoading ? (
        <LoadingBlock />
      ) : me.isError ? (
        <ErrorState error={me.error} onRetry={() => me.refetch()} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <ProfileForm s={me.data!} />
            <SecurityCard />
            <PrivacyCard />
          </div>
          <TrainersCard s={me.data!} />
        </div>
      )}
    </div>
  );
}

function ProfileForm({ s }: { s: StudentDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { refreshUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(s.avatarUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [f, setF] = useState({
    name: s.name,
    phone: s.phone ?? '',
    birthDate: toInputDate(s.birthDate),
    sex: s.sex ?? '',
    heightCm: s.heightCm?.toString() ?? '',
    currentWeightKg: s.currentWeightKg?.toString() ?? '',
    goal: s.goal ?? '',
    level: s.level,
    weeklyFrequency: String(s.weeklyFrequency),
    gymName: s.gym?.name ?? '',
    gymCity: s.gym?.city ?? '',
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const n = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(',', '.')));

  async function onAvatar(file: File) {
    setUploading(true);
    try {
      const res = await uploadFile(file, 'avatars');
      setAvatarUrl(res.url);
      await api('/students/me', { method: 'PATCH', body: { avatarUrl: res.url } });
      await refreshUser();
      toast.success('Foto atualizada');
    } catch (err) {
      toast.error('Falha no envio', errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  const save = useMutation({
    mutationFn: () =>
      api('/students/me', {
        method: 'PATCH',
        body: {
          name: f.name.trim(),
          phone: f.phone || undefined,
          birthDate: f.birthDate ? new Date(`${f.birthDate}T12:00:00`).toISOString() : undefined,
          sex: f.sex || undefined,
          heightCm: n(f.heightCm),
          currentWeightKg: n(f.currentWeightKg),
          goal: f.goal || undefined,
          level: f.level,
          weeklyFrequency: n(f.weeklyFrequency),
          gymName: f.gymName || undefined,
          gymCity: f.gymCity || undefined,
        },
      }),
    onSuccess: async () => {
      toast.success('Perfil atualizado');
      qc.invalidateQueries({ queryKey: ['student', 'me'] });
      qc.invalidateQueries({ queryKey: ['dashboard-student'] });
      await refreshUser().catch(() => undefined);
    },
    onError: (e) => toast.error('Não foi possível salvar', errorMessage(e)),
  });

  return (
    <Card>
      <CardHeader title="Meus dados" icon={<UserRound className="size-4" />} />
      <CardBody>
        <div className="mb-5 flex items-center gap-4">
          <div className="relative">
            <Avatar name={f.name} src={avatarUrl} size={72} />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full border-2 border-surface bg-accent text-accent-fg"
              aria-label="Alterar foto"
            >
              <Camera className="size-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onAvatar(e.target.files[0])} />
          </div>
          <div>
            <p className="font-semibold">{s.name}</p>
            <p className="text-sm text-muted">{s.email}</p>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Input label="Nome" value={f.name} onChange={set('name')} wrapperClassName="sm:col-span-2" />
          <Input label="Telefone" value={f.phone} onChange={set('phone')} />
          <Input label="Nascimento" type="date" value={f.birthDate} onChange={set('birthDate')} />
          <Select label="Sexo" value={f.sex} onChange={set('sex')} placeholder="—" options={Object.entries(SEX_LABELS).map(([value, label]) => ({ value, label }))} />
          <Input label="Altura (cm)" inputMode="numeric" value={f.heightCm} onChange={set('heightCm')} />
          <Input label="Peso atual (kg)" inputMode="decimal" value={f.currentWeightKg} onChange={set('currentWeightKg')} />
          <Select label="Objetivo" value={f.goal} onChange={set('goal')} placeholder="—" options={Object.entries(TRAINING_GOAL_LABELS).map(([value, label]) => ({ value, label }))} />
          <Select label="Nível" value={f.level} onChange={set('level')} options={Object.entries(TRAINING_LEVEL_LABELS).map(([value, label]) => ({ value, label }))} />
          <Input label="Treinos por semana" type="number" min={1} max={7} value={f.weeklyFrequency} onChange={set('weeklyFrequency')} />
          <Input label="Academia" value={f.gymName} onChange={set('gymName')} />
          <Input label="Cidade" value={f.gymCity} onChange={set('gymCity')} />
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" loading={save.isPending}>
              <Save className="size-4" /> Salvar
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function TrainersCard({ s }: { s: StudentDetail }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const accept = useMutation({
    mutationFn: () => api('/invites/accept', { method: 'POST', body: { code: code.trim().toUpperCase() } }),
    onSuccess: () => {
      toast.success('Vínculo criado!');
      setCode('');
      qc.invalidateQueries();
    },
    onError: (e) => toast.error('Código inválido', errorMessage(e)),
  });
  return (
    <Card className="h-fit">
      <CardHeader title="Meu personal" icon={<UserPlus className="size-4" />} />
      <CardBody className="space-y-3">
        {s.trainers.length === 0 && <p className="text-sm text-muted">Você ainda não está vinculado a um personal.</p>}
        {s.trainers.map((t) => (
          <div key={t.linkId} className="flex items-center gap-3">
            <Avatar name={t.name} src={t.avatarUrl} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{t.name}</p>
              <p className="text-xs text-muted">desde {fmtDate(t.startedAt)}</p>
            </div>
            <Badge tone={linkTone(t.status)}>{LINK_STATUS_LABELS[t.status]}</Badge>
          </div>
        ))}
        <form
          className="flex gap-2 border-t border-border pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            accept.mutate();
          }}
        >
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código do professor" className="h-10 font-mono uppercase" aria-label="Código do professor" />
          <Button type="submit" variant="secondary" className="h-10" loading={accept.isPending} disabled={!code.trim()}>
            Vincular
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
