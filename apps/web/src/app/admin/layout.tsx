'use client';

import { CreditCard, LayoutDashboard, Package, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppShell, type NavItem } from '@/components/app-shell';
import { useRoleGuard } from '@/lib/auth';

const nav: NavItem[] = [
  { href: '/admin', label: 'Visão geral', icon: <LayoutDashboard />, primary: true, exact: true },
  { href: '/admin/usuarios', label: 'Usuários', icon: <Users />, primary: true },
  { href: '/admin/assinaturas', label: 'Assinaturas', icon: <CreditCard />, primary: true },
  { href: '/admin/planos', label: 'Planos', icon: <Package />, primary: true },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { allowed } = useRoleGuard('ADMIN');
  return (
    <AppShell nav={nav} allowed={allowed} areaLabel="Administração da plataforma">
      {children}
    </AppShell>
  );
}
