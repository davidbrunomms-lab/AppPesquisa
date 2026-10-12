'use client';

import type { Paginated, UserRole } from '@personalpro/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, LoadingBlock, PageHeader, Segmented } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, relativeDays } from '@/lib/format';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string | null;
  deletedAt: string | null;
}

const ROLE_LABELS: Record<UserRole, string> = { STUDENT: 'Aluno', TRAINER: 'Professor', ADMIN: 'Admin' };
const ROLE_TONE = { STUDENT: 'info', TRAINER: 'accent', ADMIN: 'warning' } as const;
const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const [role, setRole] = useState<UserRole | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const q = useQuery({
    queryKey: ['admin-users', role, debounced, page],
    queryFn: () => api<Paginated<AdminUser>>('/admin/users', { query: { role: role === 'ALL' ? undefined : role, search: debounced, page, pageSize: PAGE_SIZE } }),
    placeholderData: (p) => p,
  });
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;

  return (
    <div>
      <PageHeader title="Usuários" subtitle={q.data ? `${q.data.total} usuário(s)` : 'Todos os usuários da plataforma'} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail" className="pl-10" />
        </div>
        <Segmented
          className="h-11 items-center"
          value={role}
          onChange={(v) => {
            setRole(v);
            setPage(1);
          }}
          options={[
            { value: 'ALL', label: 'Todos' },
            { value: 'TRAINER', label: 'Professores' },
            { value: 'STUDENT', label: 'Alunos' },
            { value: 'ADMIN', label: 'Admins' },
          ]}
        />
      </div>
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data!.items.length === 0 ? (
        <Card>
          <EmptyState icon={<Users className="size-5" />} title="Nenhum usuário encontrado" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] whitespace-nowrap text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-3 font-medium">Usuário</th>
                  <th className="px-4 py-3 font-medium">Perfil</th>
                  <th className="px-4 py-3 font-medium">Cadastro</th>
                  <th className="px-4 py-3 font-medium">Último acesso</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {q.data!.items.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-2/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size={32} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{u.name}</p>
                          <p className="truncate text-xs text-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                    </td>
                    <td className="tabular px-4 py-3 text-muted">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-muted">{u.lastLoginAt ? relativeDays(u.lastLoginAt) : 'Nunca'}</td>
                    <td className="px-4 py-3">{u.deletedAt ? <Badge tone="danger">Excluído</Badge> : <Badge tone="success">Ativo</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted">
            <span>
              Página {page} de {pages}
            </span>
            <div className="flex gap-1">
              <Button size="icon" variant="secondary" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="icon" variant="secondary" aria-label="Próxima página" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
