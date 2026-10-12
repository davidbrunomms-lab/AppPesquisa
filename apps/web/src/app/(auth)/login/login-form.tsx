'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { GoogleSignIn } from '@/components/google-sign-in';
import { Button, Input } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { homeForRole } from '@/lib/session';
import type { PublicUser } from '@personalpro/shared';

export function LoginForm() {
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(params.get('expirada') ? 'Sua sessão expirou. Entre novamente.' : null);

  const go = (u: PublicUser) => {
    const home = homeForRole(u.role);
    // Só respeita "next" se for do mesmo painel (ou página pública de convite).
    const target = next && (next.startsWith(home) || next.startsWith('/convite')) ? next : home;
    router.replace(target);
  };

  useEffect(() => {
    if (ready && user) go(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      go(res.user);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Bem-vindo de volta</h1>
      <p className="mt-2 text-sm text-muted">Entre para acessar seus treinos, alunos e evolução.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Input label="E-mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
        <div>
          <Input label="Senha" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          <div className="mt-2 text-right">
            <Link href="/esqueci-senha" className="text-xs font-medium text-muted hover:text-fg">
              Esqueci minha senha
            </Link>
          </div>
        </div>
        {error && <p className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" loading={loading} className="w-full">
          Entrar
        </Button>
      </form>

      <GoogleSignIn onSuccess={go} />

      <p className="mt-8 text-center text-sm text-muted">
        Primeiro acesso?{' '}
        <Link href="/cadastro" className="font-semibold text-accent-ink hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
