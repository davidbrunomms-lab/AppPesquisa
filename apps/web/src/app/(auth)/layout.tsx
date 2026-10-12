import { BarChart3, CalendarCheck2, Dumbbell, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/app-shell';

const features = [
  { icon: Dumbbell, title: 'Treinos inteligentes', text: 'Fichas com técnicas avançadas, carga sugerida e histórico de cada série.' },
  { icon: BarChart3, title: 'Evolução visível', text: 'Peso, medidas, fotos antes x depois e progressão de carga em gráficos.' },
  { icon: CalendarCheck2, title: 'Agenda integrada', text: 'Horários disponíveis, solicitações e lembretes automáticos.' },
  { icon: MessageCircle, title: 'Chat em tempo real', text: 'Tire dúvidas com seu personal com fotos, vídeos e áudios.' },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-border bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -left-40 size-[520px] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--accent), transparent 65%)' }}
        />
        <Link href="/" className="relative">
          <Logo />
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight">
            Mais resultados para alunos. <span className="text-accent-ink">Menos planilhas</span> para o personal.
          </h2>
          <ul className="mt-10 space-y-6">
            {features.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-surface-2 text-accent-ink">
                  <f.icon className="size-5" />
                </span>
                <div>
                  <p className="font-medium">{f.title}</p>
                  <p className="text-sm text-muted">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-subtle">
          © {new Date().getFullYear()} PersonalPro ·{' '}
          <Link href="/privacidade" className="hover:text-fg">
            Privacidade
          </Link>{' '}
          ·{' '}
          <Link href="/termos" className="hover:text-fg">
            Termos
          </Link>
        </p>
      </section>
      <section className="flex flex-col px-4 py-8 sm:px-8">
        <Link href="/" className="mb-8 lg:hidden">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center">{children}</div>
      </section>
    </div>
  );
}
