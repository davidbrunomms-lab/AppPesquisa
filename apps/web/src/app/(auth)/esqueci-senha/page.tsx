'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button, Input } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim() }, auth: false });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
          <MailCheck className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Verifique seu e-mail</h1>
        <p className="mt-2 text-sm text-muted">
          Se existir uma conta para <strong className="text-fg">{email}</strong>, enviamos um link para redefinir a senha. O link expira em breve.
        </p>
        <Link href="/login" className="mt-8 inline-block text-sm font-semibold text-accent-ink hover:underline">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Esqueceu a senha?</h1>
      <p className="mt-2 text-sm text-muted">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Input label="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        {error && <p className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" loading={loading} className="w-full">
          Enviar link
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        Lembrou?{' '}
        <Link href="/login" className="font-semibold text-accent-ink hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
