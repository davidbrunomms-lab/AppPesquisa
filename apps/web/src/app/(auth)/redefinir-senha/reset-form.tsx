'use client';

import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Input, LinkButton } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';

export function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return setError('A senha deve ter ao menos 8 caracteres, com letras e números.');
    if (password !== confirm) return setError('As senhas não conferem.');
    setLoading(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password }, auth: false });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Link inválido</h1>
        <p className="mt-2 text-sm text-muted">O link de redefinição está incompleto. Solicite um novo.</p>
        <LinkButton href="/esqueci-senha" className="mt-6">
          Solicitar novo link
        </LinkButton>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
          <CheckCircle2 className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Senha definida!</h1>
        <p className="mt-2 text-sm text-muted">Agora é só entrar com seu e-mail e a nova senha.</p>
        <LinkButton href="/login" size="lg" className="mt-8 w-full">
          Ir para o login
        </LinkButton>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Definir nova senha</h1>
      <p className="mt-2 text-sm text-muted">
        Crie uma senha com pelo menos 8 caracteres, letras e números. Se o seu personal cadastrou você, este é o seu primeiro acesso.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Input label="Nova senha" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        <Input label="Confirmar senha" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        <p className="text-xs text-subtle">
          Ao definir a senha você concorda com os{' '}
          <Link href="/termos" className="underline">
            Termos de uso
          </Link>{' '}
          e a{' '}
          <Link href="/privacidade" className="underline">
            Política de Privacidade
          </Link>
          .
        </p>
        {error && <p className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" loading={loading} className="w-full">
          Salvar senha
        </Button>
      </form>
    </div>
  );
}
