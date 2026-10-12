'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { BadgeCheck, CircleAlert, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Logo } from '@/components/app-shell';
import { useToast } from '@/components/toast';
import { Avatar, Badge, Button, Card, ErrorState, LinkButton, LoadingBlock } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface InvitePreview {
  code: string;
  trainer: { id: string; name: string; avatarUrl: string | null; cref: string | null; specialties: string[] };
  invitedName: string | null;
}

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user, ready } = useAuth();
  const preview = useQuery({
    queryKey: ['invite-preview', code],
    queryFn: () => api<InvitePreview>(`/invites/${encodeURIComponent(code)}/preview`, { auth: false }),
  });
  const accept = useMutation({
    mutationFn: () => api('/invites/accept', { method: 'POST', body: { code } }),
    onSuccess: () => {
      toast.success('Convite aceito!', 'Agora você está vinculado ao seu personal.');
      router.replace('/aluno');
    },
    onError: (err) => toast.error('Não foi possível aceitar o convite', errorMessage(err)),
  });

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-8">
      <Link href="/">
        <Logo />
      </Link>
      <div className="flex w-full max-w-md flex-1 flex-col justify-center py-10">
        {preview.isLoading && <LoadingBlock />}
        {preview.isError && <ErrorState error={preview.error} />}
        {preview.data && (
          <Card className="overflow-hidden">
            <div className="h-24 bg-gradient-to-br from-accent/40 via-accent/10 to-transparent" />
            <div className="-mt-12 px-6 pb-6">
              <Avatar name={preview.data.trainer.name} src={preview.data.trainer.avatarUrl} size={88} className="ring-4 ring-surface" />
              <p className="mt-4 text-xs font-semibold tracking-wider text-accent-ink uppercase">Convite de treino</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                {preview.data.invitedName ? `${preview.data.invitedName.split(' ')[0]}, ` : ''}
                {preview.data.trainer.name} convidou você
              </h1>
              {preview.data.trainer.cref && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                  <BadgeCheck className="size-4 text-accent-ink" /> CREF {preview.data.trainer.cref}
                </p>
              )}
              {preview.data.trainer.specialties.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {preview.data.trainer.specialties.map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </div>
              )}
              <p className="mt-5 text-sm text-muted">
                Aceite o convite para receber seus treinos, registrar cargas, acompanhar sua evolução e conversar com seu personal.
              </p>
              <div className="mt-4 rounded-xl border border-dashed border-border-strong bg-surface-2 px-4 py-3 text-center">
                <p className="text-xs text-muted">Código do professor</p>
                <p className="font-mono text-xl font-semibold tracking-[0.3em]">{preview.data.code}</p>
              </div>

              <div className="mt-6 space-y-2">
                {!ready ? null : user?.role === 'STUDENT' ? (
                  <Button size="lg" className="w-full" loading={accept.isPending} onClick={() => accept.mutate()}>
                    <UserPlus className="size-5" /> Aceitar convite
                  </Button>
                ) : user ? (
                  <p className="flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" /> Você está conectado como {user.role === 'TRAINER' ? 'professor' : 'administrador'}. Convites são aceitos por contas de aluno.
                  </p>
                ) : (
                  <>
                    <LinkButton href={`/cadastro?perfil=aluno&codigo=${encodeURIComponent(preview.data.code)}`} size="lg" className="w-full">
                      Criar minha conta
                    </LinkButton>
                    <LinkButton href={`/login?next=${encodeURIComponent(`/convite/${preview.data.code}`)}`} variant="secondary" size="lg" className="w-full">
                      Já tenho conta
                    </LinkButton>
                  </>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
