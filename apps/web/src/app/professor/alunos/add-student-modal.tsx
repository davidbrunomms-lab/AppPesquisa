'use client';

import { TRAINING_GOAL_LABELS, TRAINING_LEVEL_LABELS, type InviteResponse, type TrainerProfile } from '@personalpro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Mail, MessageCircle, QrCode, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Button, Input, Modal, Select, Tabs } from '@/components/ui';
import { api, API_URL, errorMessage } from '@/lib/api';

type Mode = 'manual' | 'whatsapp' | 'email' | 'code';

export function AddStudentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('manual');
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Adicionar aluno" description="Cadastre manualmente ou envie um convite para o aluno criar a própria conta.">
      <Tabs
        value={mode}
        onChange={setMode}
        className="mb-5"
        tabs={[
          { value: 'manual', label: 'Manual', icon: <UserPlus className="size-4" /> },
          { value: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="size-4" /> },
          { value: 'email', label: 'E-mail', icon: <Mail className="size-4" /> },
          { value: 'code', label: 'Código / QR', icon: <QrCode className="size-4" /> },
        ]}
      />
      {mode === 'manual' && <ManualForm onDone={onClose} />}
      {mode === 'whatsapp' && <InviteForm channel="WHATSAPP" />}
      {mode === 'email' && <InviteForm channel="EMAIL" />}
      {mode === 'code' && <CodePanel />}
    </Modal>
  );
}

function ManualForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({
    name: '',
    email: '',
    phone: '',
    birthDate: '',
    sex: '',
    heightCm: '',
    currentWeightKg: '',
    goal: '',
    level: 'BEGINNER',
    weeklyFrequency: '3',
    gymName: '',
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const create = useMutation({
    mutationFn: () =>
      api<{ invited: boolean }>('/students', {
        method: 'POST',
        body: {
          name: f.name.trim(),
          email: f.email.trim(),
          phone: f.phone || undefined,
          birthDate: f.birthDate ? new Date(`${f.birthDate}T12:00:00`).toISOString() : undefined,
          sex: f.sex || undefined,
          heightCm: f.heightCm ? Number(f.heightCm) : undefined,
          currentWeightKg: f.currentWeightKg ? Number(f.currentWeightKg.replace(',', '.')) : undefined,
          goal: f.goal || undefined,
          level: f.level,
          weeklyFrequency: Number(f.weeklyFrequency) || undefined,
          gymName: f.gymName || undefined,
        },
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['dashboard-trainer'] });
      if (res.invited) toast.info('Convite enviado', 'Este e-mail já possui conta de aluno. Enviamos um convite para ele aceitar o vínculo.');
      else toast.success('Aluno cadastrado!', 'Enviamos um e-mail para ele criar a senha de acesso.');
      onDone();
    },
    onError: (e) => toast.error('Não foi possível cadastrar', errorMessage(e)),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
      className="grid gap-3 sm:grid-cols-2"
    >
      <Input label="Nome completo *" required value={f.name} onChange={set('name')} wrapperClassName="sm:col-span-2" />
      <Input label="E-mail *" type="email" required value={f.email} onChange={set('email')} hint="O aluno recebe um link para criar a senha" />
      <Input label="Telefone" type="tel" value={f.phone} onChange={set('phone')} />
      <Input label="Data de nascimento" type="date" value={f.birthDate} onChange={set('birthDate')} />
      <Select
        label="Sexo"
        value={f.sex}
        onChange={set('sex')}
        placeholder="—"
        options={[
          { value: 'FEMALE', label: 'Feminino' },
          { value: 'MALE', label: 'Masculino' },
          { value: 'OTHER', label: 'Outro' },
        ]}
      />
      <Input label="Altura (cm)" inputMode="numeric" value={f.heightCm} onChange={set('heightCm')} />
      <Input label="Peso atual (kg)" inputMode="decimal" value={f.currentWeightKg} onChange={set('currentWeightKg')} />
      <Select label="Objetivo" value={f.goal} onChange={set('goal')} placeholder="—" options={Object.entries(TRAINING_GOAL_LABELS).map(([value, label]) => ({ value, label }))} />
      <Select label="Nível" value={f.level} onChange={set('level')} options={Object.entries(TRAINING_LEVEL_LABELS).map(([value, label]) => ({ value, label }))} />
      <Input label="Frequência semanal" type="number" min={1} max={7} value={f.weeklyFrequency} onChange={set('weeklyFrequency')} />
      <Input label="Academia" value={f.gymName} onChange={set('gymName')} />
      <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
        <Button type="submit" loading={create.isPending}>
          Cadastrar aluno
        </Button>
      </div>
    </form>
  );
}

function InviteForm({ channel }: { channel: 'WHATSAPP' | 'EMAIL' }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [result, setResult] = useState<InviteResponse | null>(null);
  const create = useMutation({
    mutationFn: () =>
      api<InviteResponse>('/invites', {
        method: 'POST',
        body: { channel, name: name || undefined, ...(channel === 'EMAIL' ? { email: contact } : { phone: contact.replace(/\D/g, '') || undefined }) },
      }),
    onSuccess: (res) => {
      setResult(res);
      if (channel === 'WHATSAPP' && res.whatsappUrl) window.open(res.whatsappUrl, '_blank', 'noopener');
      if (channel === 'EMAIL') toast.success('Convite enviado por e-mail');
    },
    onError: (e) => toast.error('Erro ao criar convite', errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <Input label="Nome do aluno" value={name} onChange={(e) => setName(e.target.value)} />
        {channel === 'EMAIL' ? (
          <Input label="E-mail *" type="email" required value={contact} onChange={(e) => setContact(e.target.value)} />
        ) : (
          <Input label="WhatsApp (com DDD)" type="tel" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="5511999999999" hint="Opcional — sem número, você escolhe o contato no WhatsApp" />
        )}
        <div className="sm:col-span-2">
          <Button type="submit" loading={create.isPending}>
            {channel === 'EMAIL' ? <Mail className="size-4" /> : <MessageCircle className="size-4" />}
            {channel === 'EMAIL' ? 'Enviar convite por e-mail' : 'Abrir no WhatsApp'}
          </Button>
        </div>
      </form>
      {result && <InviteResult res={result} />}
    </div>
  );
}

function InviteResult({ res }: { res: InviteResponse }) {
  const toast = useToast();
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm">
      <p className="font-medium">Convite criado · código {res.invite.code}</p>
      <p className="mt-1 text-xs text-muted">Válido até {new Date(res.invite.expiresAt).toLocaleDateString('pt-BR')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            navigator.clipboard?.writeText(res.webUrl);
            toast.success('Link copiado');
          }}
        >
          <Copy className="size-3.5" /> Copiar link
        </Button>
        {res.whatsappUrl && (
          <a href={res.whatsappUrl} target="_blank" rel="noreferrer">
            <Button size="sm" variant="secondary">
              <MessageCircle className="size-3.5" /> Abrir WhatsApp de novo
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

function CodePanel() {
  const toast = useToast();
  const me = useQuery({ queryKey: ['trainer-me'], queryFn: () => api<TrainerProfile>('/trainers/me') });
  const code = me.data?.inviteCode;
  const link = typeof window !== 'undefined' && code ? `${window.location.origin}/convite/${code}` : '';
  return (
    <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
      <div className="rounded-2xl bg-white p-3">
        {code ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${API_URL}/invites/${code}/qrcode.png`} alt={`QR Code do convite ${code}`} className="size-44" />
        ) : (
          <div className="size-44 animate-pulse rounded-xl bg-neutral-200" />
        )}
      </div>
      <div className="flex-1">
        <p className="text-sm text-muted">Seu código de professor</p>
        <p className="mt-1 font-mono text-3xl font-semibold tracking-[0.25em]">{code ?? '······'}</p>
        <p className="mt-3 text-sm text-muted">O aluno informa o código no cadastro, aponta a câmera para o QR Code ou abre o link de convite.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
          <Button
            size="sm"
            variant="secondary"
            disabled={!code}
            onClick={() => {
              navigator.clipboard?.writeText(code ?? '');
              toast.success('Código copiado');
            }}
          >
            <Copy className="size-3.5" /> Copiar código
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!link}
            onClick={() => {
              navigator.clipboard?.writeText(link);
              toast.success('Link copiado');
            }}
          >
            <Copy className="size-3.5" /> Copiar link
          </Button>
        </div>
      </div>
    </div>
  );
}
