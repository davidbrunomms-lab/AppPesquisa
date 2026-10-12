'use client';

import type { PublicUser } from '@personalpro/shared';
import { Dumbbell, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { GoogleSignIn } from '@/components/google-sign-in';
import { useToast } from '@/components/toast';
import { Button, Checkbox, Input } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { homeForRole } from '@/lib/session';

export function RegisterForm() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { register } = useAuth();
  const initialCode = params.get('codigo') ?? params.get('code') ?? '';
  const [role, setRole] = useState<'STUDENT' | 'TRAINER'>(params.get('perfil') === 'professor' ? 'TRAINER' : 'STUDENT');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '', cref: '', inviteCode: initialCode });
  const [accept, setAccept] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const weak = form.password.length > 0 && (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password));

  const done = (u: PublicUser) => router.replace(homeForRole(u.role));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (weak) return setError('A senha deve ter ao menos 8 caracteres, com letras e números.');
    if (form.password !== form.confirm) return setError('As senhas não conferem.');
    if (!accept) return setError('Para continuar, aceite os Termos de uso e a Política de Privacidade.');
    setLoading(true);
    try {
      const res = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role,
        phone: form.phone.trim() || undefined,
        cref: role === 'TRAINER' ? form.cref.trim() || undefined : undefined,
        inviteCode: role === 'STUDENT' ? form.inviteCode.trim().toUpperCase() || undefined : undefined,
        acceptTerms: true,
        marketingOptIn: marketing,
      });
      if (res.linkError) toast.error('Conta criada, mas não foi possível vincular ao professor', res.linkError);
      else toast.success('Conta criada com sucesso!');
      done(res.user);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div className="py-2">
      <h1 className="text-3xl font-semibold tracking-tight">Criar sua conta</h1>
      <p className="mt-2 text-sm text-muted">Primeiro acesso ao PersonalPro. Leva menos de um minuto.</p>

      <div className="mt-6 grid grid-cols-2 gap-2">
        {(
          [
            { v: 'STUDENT', label: 'Sou aluno', icon: GraduationCap, text: 'Treinos e evolução' },
            { v: 'TRAINER', label: 'Sou personal', icon: Dumbbell, text: 'Gerencie alunos' },
          ] as const
        ).map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setRole(o.v)}
            className={cn(
              'flex flex-col items-start gap-2 rounded-2xl border p-3.5 text-left transition',
              role === o.v ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:border-border-strong',
            )}
          >
            <o.icon className={cn('size-5', role === o.v ? 'text-accent-ink' : 'text-muted')} />
            <span>
              <span className="block text-sm font-semibold">{o.label}</span>
              <span className="block text-xs text-muted">{o.text}</span>
            </span>
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input label="Nome completo" required value={form.name} onChange={set('name')} autoComplete="name" />
        <Input label="E-mail" type="email" required value={form.email} onChange={set('email')} autoComplete="email" />
        <Input label="Telefone (WhatsApp)" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="(11) 99999-0000" />
        {role === 'TRAINER' ? (
          <Input label="CREF" value={form.cref} onChange={set('cref')} placeholder="000000-G/UF" hint="Opcional agora — você pode informar depois no perfil." />
        ) : (
          <Input
            label="Código do professor"
            value={form.inviteCode}
            onChange={set('inviteCode')}
            placeholder="Ex.: DEMO01"
            className="uppercase"
            hint="Recebeu um convite? Informe o código para se vincular automaticamente."
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Senha" type="password" required value={form.password} onChange={set('password')} autoComplete="new-password" error={weak ? 'Mín. 8 caracteres, letras e números' : null} />
          <Input label="Confirmar senha" type="password" required value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
        </div>
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <Checkbox checked={accept} onChange={setAccept}>
            Li e aceito os{' '}
            <Link href="/termos" target="_blank" className="font-medium text-accent-ink underline-offset-2 hover:underline">
              Termos de uso
            </Link>{' '}
            e a{' '}
            <Link href="/privacidade" target="_blank" className="font-medium text-accent-ink underline-offset-2 hover:underline">
              Política de Privacidade
            </Link>
            , e consinto com o tratamento dos meus dados de saúde (peso, medidas, fotos) para acompanhamento dos treinos.
          </Checkbox>
          <Checkbox checked={marketing} onChange={setMarketing}>
            Quero receber novidades e dicas por e-mail (opcional).
          </Checkbox>
        </div>
        {error && <p className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" loading={loading} disabled={!accept} className="w-full">
          Criar conta
        </Button>
      </form>

      <GoogleSignIn onSuccess={done} inviteCode={form.inviteCode || undefined} />

      <p className="mt-8 text-center text-sm text-muted">
        Já tem conta?{' '}
        <Link href="/login" className="font-semibold text-accent-ink hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
