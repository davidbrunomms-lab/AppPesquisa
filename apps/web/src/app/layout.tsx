import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'PersonalPro', template: '%s · PersonalPro' },
  description: 'Plataforma para personal trainers e alunos: treinos, evolução, agenda e chat.',
  applicationName: 'PersonalPro',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0b0d' },
    { media: '(prefers-color-scheme: light)', color: '#f5f6f7' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-bg text-fg">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
