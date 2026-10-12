'use client';

import type { AvailabilitySlot, Gym, TrainerProfile } from '@personalpro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AtSign, Camera, Clock, MapPin, Plus, Save, Star, Trash2, UserRound, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PrivacyCard, SecurityCard } from '@/components/account-section';
import { SubscriptionCard } from '@/components/subscription-card';
import { useToast } from '@/components/toast';
import { Avatar, Button, Card, CardBody, CardHeader, ErrorState, Input, LoadingBlock, PageHeader, StatCard, Tabs, Textarea } from '@/components/ui';
import { api, errorMessage, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { WEEKDAYS_LONG } from '@/lib/format';

type Tab = 'perfil' | 'assinatura' | 'conta';
const SOCIAL = [
  { key: 'instagram', label: 'Instagram', placeholder: '@seuperfil' },
  { key: 'youtube', label: 'YouTube', placeholder: 'youtube.com/@canal' },
  { key: 'tiktok', label: 'TikTok', placeholder: '@seuperfil' },
  { key: 'site', label: 'Site', placeholder: 'https://' },
];

export default function TrainerProfilePage() {
  const [tab, setTab] = useState<Tab>('perfil');
  useEffect(() => {
    if (window.location.hash === '#assinatura') setTab('assinatura');
    if (window.location.hash === '#conta') setTab('conta');
  }, []);
  const me = useQuery({ queryKey: ['trainer-me'], queryFn: () => api<TrainerProfile>('/trainers/me') });

  return (
    <div>
      <PageHeader title="Perfil" subtitle="Seu perfil profissional, assinatura e privacidade" />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={(t) => {
          setTab(t);
          history.replaceState(null, '', `#${t}`);
        }}
        tabs={[
          { value: 'perfil', label: 'Perfil profissional' },
          { value: 'assinatura', label: 'Assinatura' },
          { value: 'conta', label: 'Conta e privacidade' },
        ]}
      />
      {tab === 'perfil' && (me.isLoading ? <LoadingBlock /> : me.isError ? <ErrorState error={me.error} /> : <ProfileForm profile={me.data!} />)}
      {tab === 'assinatura' && <SubscriptionCard />}
      {tab === 'conta' && (
        <div className="space-y-4">
          <SecurityCard />
          <PrivacyCard />
        </div>
      )}
    </div>
  );
}

function ProfileForm({ profile: p }: { profile: TrainerProfile }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { refreshUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(p.user.avatarUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [f, setF] = useState({
    name: p.user.name,
    phone: p.user.phone ?? '',
    cref: p.cref ?? '',
    bio: p.bio ?? '',
    experienceYears: p.experienceYears?.toString() ?? '',
  });
  const [specialties, setSpecialties] = useState<string[]>(p.specialties);
  const [newSpec, setNewSpec] = useState('');
  const [social, setSocial] = useState<Record<string, string>>(p.socialLinks ?? {});
  const [gyms, setGyms] = useState<Omit<Gym, 'id'>[]>(p.gyms.map(({ name, city, state, address }) => ({ name, city, state, address })));
  const [availability, setAvailability] = useState<AvailabilitySlot[]>(p.availability.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime })));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function onAvatar(file: File) {
    setUploading(true);
    try {
      const res = await uploadFile(file, 'avatars');
      setAvatarUrl(res.url);
      await api('/trainers/me', { method: 'PATCH', body: { avatarUrl: res.url } });
      await refreshUser();
      qc.invalidateQueries({ queryKey: ['trainer-me'] });
      toast.success('Foto atualizada');
    } catch (err) {
      toast.error('Falha no envio da foto', errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  const save = useMutation({
    mutationFn: () =>
      api('/trainers/me', {
        method: 'PATCH',
        body: {
          name: f.name.trim(),
          phone: f.phone || undefined,
          avatarUrl: avatarUrl || undefined,
          cref: f.cref || undefined,
          specialties,
          bio: f.bio || undefined,
          experienceYears: f.experienceYears ? Number(f.experienceYears) : undefined,
          socialLinks: Object.fromEntries(Object.entries(social).filter(([, v]) => v.trim())),
          gyms: gyms.filter((g) => g.name.trim()).map((g) => ({ name: g.name.trim(), city: g.city || undefined, state: g.state || undefined, address: g.address || undefined })),
          availability: availability.filter((a) => a.startTime < a.endTime),
        },
      }),
    onSuccess: async () => {
      toast.success('Perfil salvo');
      qc.invalidateQueries({ queryKey: ['trainer-me'] });
      await refreshUser().catch(() => undefined);
    },
    onError: (e) => toast.error('Não foi possível salvar', errorMessage(e)),
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Card>
          <CardHeader title="Dados profissionais" icon={<UserRound className="size-4" />} />
          <CardBody className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar name={f.name} src={avatarUrl} size={76} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full border-2 border-surface bg-accent text-accent-fg"
                  aria-label="Alterar foto"
                  disabled={uploading}
                >
                  <Camera className="size-4" />
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onAvatar(e.target.files[0])} />
              </div>
              <div className="text-sm text-muted">{uploading ? 'Enviando foto…' : 'Foto de perfil exibida aos alunos e no convite.'}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Nome" value={f.name} onChange={set('name')} />
              <Input label="Telefone / WhatsApp" value={f.phone} onChange={set('phone')} />
              <Input label="CREF" value={f.cref} onChange={set('cref')} placeholder="000000-G/UF" />
              <Input label="Anos de experiência" type="number" min={0} value={f.experienceYears} onChange={set('experienceYears')} />
              <Textarea label="Bio" value={f.bio} onChange={set('bio')} wrapperClassName="sm:col-span-2" placeholder="Conte sua formação, metodologia e diferenciais." />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">Especialidades</p>
              <div className="flex flex-wrap gap-1.5">
                {specialties.map((s) => (
                  <span key={s} className="inline-flex h-8 items-center gap-1 rounded-full bg-accent-soft pr-1.5 pl-3 text-xs font-medium text-accent-ink">
                    {s}
                    <button type="button" aria-label={`Remover ${s}`} onClick={() => setSpecialties((x) => x.filter((y) => y !== s))} className="grid size-5 place-items-center rounded-full hover:bg-black/10">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = newSpec.trim();
                    if (v && !specialties.includes(v)) setSpecialties((x) => [...x, v]);
                    setNewSpec('');
                  }}
                >
                  <input value={newSpec} onChange={(e) => setNewSpec(e.target.value)} placeholder="+ adicionar" className="h-8 w-32 rounded-full border border-dashed border-border-strong bg-transparent px-3 text-xs outline-none focus:border-accent" />
                </form>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Horários disponíveis" subtitle="Faixas de atendimento por dia da semana" icon={<Clock className="size-4" />} />
          <CardBody className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const slots = availability.map((a, idx) => ({ ...a, idx })).filter((a) => a.weekday === d);
              return (
                <div key={d} className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center">
                  <p className="w-24 shrink-0 text-sm font-medium">{WEEKDAYS_LONG[d]}</p>
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    {slots.length === 0 && <span className="text-xs text-subtle">Indisponível</span>}
                    {slots.map((s) => (
                      <span key={s.idx} className="flex items-center gap-1 rounded-lg bg-surface-2 p-1">
                        <input
                          type="time"
                          value={s.startTime}
                          onChange={(e) => setAvailability((x) => x.map((a, i) => (i === s.idx ? { ...a, startTime: e.target.value } : a)))}
                          className="h-7 rounded-md bg-transparent px-1 text-xs outline-none"
                          aria-label="Início"
                        />
                        <span className="text-xs text-subtle">–</span>
                        <input
                          type="time"
                          value={s.endTime}
                          onChange={(e) => setAvailability((x) => x.map((a, i) => (i === s.idx ? { ...a, endTime: e.target.value } : a)))}
                          className="h-7 rounded-md bg-transparent px-1 text-xs outline-none"
                          aria-label="Fim"
                        />
                        <button type="button" aria-label="Remover faixa" onClick={() => setAvailability((x) => x.filter((_, i) => i !== s.idx))} className="grid size-6 place-items-center rounded-md text-muted hover:text-danger">
                          <X className="size-3.5" />
                        </button>
                      </span>
                    ))}
                    <Button size="sm" variant="ghost" onClick={() => setAvailability((x) => [...x, { weekday: d, startTime: '08:00', endTime: '12:00' }])}>
                      <Plus className="size-3.5" /> Faixa
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Academias e redes sociais" icon={<MapPin className="size-4" />} />
          <CardBody className="space-y-4">
            {gyms.map((g, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[2fr_1fr_80px_auto]">
                <Input value={g.name} onChange={(e) => setGyms((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} placeholder="Nome da academia" aria-label="Academia" className="h-10" />
                <Input value={g.city ?? ''} onChange={(e) => setGyms((x) => x.map((y, j) => (j === i ? { ...y, city: e.target.value } : y)))} placeholder="Cidade" aria-label="Cidade" className="h-10" wrapperClassName="order-3 sm:order-none" />
                <Input value={g.state ?? ''} onChange={(e) => setGyms((x) => x.map((y, j) => (j === i ? { ...y, state: e.target.value.toUpperCase().slice(0, 2) } : y)))} placeholder="UF" aria-label="UF" className="order-4 h-10 sm:order-none" />
                <Button size="icon" variant="ghost" className="size-10" aria-label="Remover academia" onClick={() => setGyms((x) => x.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => setGyms((x) => [...x, { name: '', city: '', state: '' }])}>
              <Plus className="size-3.5" /> Adicionar academia
            </Button>
            <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              {SOCIAL.map((s) => (
                <Input key={s.key} label={s.label} value={social[s.key] ?? ''} onChange={(e) => setSocial((x) => ({ ...x, [s.key]: e.target.value }))} placeholder={s.placeholder} />
              ))}
            </div>
          </CardBody>
        </Card>
        <div className="sticky bottom-20 z-10 flex justify-end lg:bottom-4">
          <Button size="lg" loading={save.isPending} onClick={() => save.mutate()} className="shadow-card">
            <Save className="size-4" /> Salvar perfil
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
          <StatCard label="Alunos ativos" value={p.activeStudents ?? 0} icon={<Users className="size-4" />} tone="accent" hint={`${p.pendingStudents ?? 0} pendentes · ${p.inactiveStudents ?? 0} inativos`} />
          <StatCard label="Avaliação média" value={p.ratingCount ? p.ratingAvg.toFixed(1) : '—'} icon={<Star className="size-4" />} tone="warning" hint={`${p.ratingCount} avaliação(ões) de alunos`} />
        </div>
        <Card className="p-4">
          <p className="text-xs text-muted">Código de convite</p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.25em]">{p.inviteCode}</p>
          {social.instagram && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
              <AtSign className="size-4" /> {social.instagram}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
