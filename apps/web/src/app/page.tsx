'use client';

import { ArrowRight, BarChart3, CalendarCheck2, Dumbbell, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Logo } from '@/components/app-shell';
import { Card, LinkButton, LoadingBlock } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { homeForRole } from '@/lib/session';

const features = [
  { icon: Dumbbell, title: 'Montagem de treinos', text: 'Biblioteca de exercícios, técnicas avançadas e atribuição por dia da semana.' },
  { icon: BarChart3, title: 'Evolução completa', text: 'Avaliações, medidas, fotos antes x depois e progressão de carga.' },
  { icon: CalendarCheck2, title: 'Agenda', text: 'Horários livres, solicitações, reagendamentos e lembretes.' },
  { icon: MessageCircle, title: 'Chat em tempo real', text: 'Dúvidas, fotos, vídeos e áudios entre aluno e personal.' },
  { icon: Sparkles, title: 'IA assistente', text: 'Sugestões de progressão que só valem após a aprovação do professor.' },
  { icon: ShieldCheck, title: 'LGPD', text: 'Dados de saúde protegidos, exportação e exclusão de conta.' },
];

export default function Home() {
  const { ready, user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (ready && user) router.replace(homeForRole(user.role));
  }, [ready, user, router]);

  if (!ready || user) return <LoadingBlock className="min-h-dvh" />;

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-64 left-1/2 size-[720px] -translate-x-1/2 rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, var(--accent), transparent 65%)' }} />
      <header className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="flex gap-2">
          <LinkButton href="/login" variant="ghost">
            Entrar
          </LinkButton>
          <LinkButton href="/cadastro" className="hidden sm:inline-flex">
            Criar conta
          </LinkButton>
        </div>
      </header>
      <main className="relative mx-auto max-w-6xl px-4 pt-14 pb-20 sm:px-6 sm:pt-24">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
          <span className="size-1.5 rounded-full bg-accent" /> Para personal trainers e alunos
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
          Treino, evolução e agenda <span className="text-accent-ink">em um só lugar.</span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
          O PersonalPro conecta o personal aos alunos com fichas inteligentes, registro de cargas, avaliações físicas e chat — no celular e na web.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton href="/cadastro?perfil=professor" size="lg">
            Sou personal <ArrowRight className="size-4" />
          </LinkButton>
          <LinkButton href="/cadastro?perfil=aluno" size="lg" variant="secondary">
            Sou aluno
          </LinkButton>
        </div>
        <div className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="p-5">
              <f.icon className="size-5 text-accent-ink" />
              <p className="mt-3 font-semibold">{f.title}</p>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </Card>
          ))}
        </div>
      </main>
      <footer className="relative border-t border-border py-6 text-center text-xs text-subtle">
        © {new Date().getFullYear()} PersonalPro ·{' '}
        <Link href="/privacidade" className="hover:text-fg">
          Política de Privacidade
        </Link>{' '}
        ·{' '}
        <Link href="/termos" className="hover:text-fg">
          Termos de uso
        </Link>
      </footer>
    </div>
  );
}
