'use client';

import type { AuthResponse, PublicUser } from '@personalpro/shared';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from './toast';
import { Button, Checkbox, Modal, Segmented } from './ui';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleIdApi {
  accounts: {
    id: {
      initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void;
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
  };
}

/**
 * Login com Google via Google Identity Services. Só aparece se
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID estiver configurado. No primeiro acesso a API
 * responde 422 ROLE_REQUIRED → perguntamos o perfil e o aceite dos termos.
 */
export function GoogleSignIn({ onSuccess, inviteCode }: { onSuccess: (u: PublicUser) => void; inviteCode?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { applyAuth } = useAuth();
  const toast = useToast();
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [role, setRole] = useState<'STUDENT' | 'TRAINER'>('STUDENT');
  const [accept, setAccept] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (idToken: string, extra?: { role: 'STUDENT' | 'TRAINER'; acceptTerms: true }) => {
    const res = await api<AuthResponse>('/auth/social', {
      method: 'POST',
      auth: false,
      body: { provider: 'GOOGLE', idToken, inviteCode, ...extra },
    });
    applyAuth(res);
    onSuccess(res.user);
  };

  useEffect(() => {
    if (!CLIENT_ID || !ref.current) return;
    const init = () => {
      const g = (window as unknown as { google?: GoogleIdApi }).google;
      if (!g || !ref.current) return;
      g.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async ({ credential }) => {
          try {
            await submit(credential);
          } catch (err) {
            if (err instanceof ApiError && err.code === 'ROLE_REQUIRED') setPendingToken(credential);
            else toast.error('Falha no login com Google', errorMessage(err));
          }
        },
      });
      g.accounts.id.renderButton(ref.current, { theme: 'filled_black', size: 'large', shape: 'pill', width: 360, locale: 'pt-BR', text: 'continue_with' });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-gis]');
    if (existing) {
      init();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.dataset.gis = '1';
    s.onload = init;
    document.head.appendChild(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <>
      <div className="my-6 flex items-center gap-3 text-xs text-subtle">
        <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
      </div>
      <div ref={ref} className="flex justify-center" />
      <Modal
        open={!!pendingToken}
        onClose={() => setPendingToken(null)}
        title="Complete seu cadastro"
        description="Como você vai usar o PersonalPro?"
        footer={
          <Button
            disabled={!accept}
            loading={loading}
            onClick={async () => {
              if (!pendingToken) return;
              setLoading(true);
              try {
                await submit(pendingToken, { role, acceptTerms: true });
              } catch (err) {
                toast.error('Não foi possível concluir', errorMessage(err));
              } finally {
                setLoading(false);
              }
            }}
          >
            Continuar
          </Button>
        }
      >
        <div className="space-y-4">
          <Segmented
            className="w-full"
            value={role}
            onChange={setRole}
            options={[
              { value: 'STUDENT', label: 'Sou aluno' },
              { value: 'TRAINER', label: 'Sou personal' },
            ]}
          />
          <Checkbox checked={accept} onChange={setAccept}>
            Li e aceito os{' '}
            <Link href="/termos" target="_blank" className="text-accent-ink underline">
              Termos de uso
            </Link>{' '}
            e a{' '}
            <Link href="/privacidade" target="_blank" className="text-accent-ink underline">
              Política de Privacidade
            </Link>
            , inclusive o tratamento de dados de saúde.
          </Checkbox>
        </div>
      </Modal>
    </>
  );
}
