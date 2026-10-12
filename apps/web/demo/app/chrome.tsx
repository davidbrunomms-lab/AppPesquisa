/**
 * Elementos exclusivos da demo: faixa "Versão de demonstração" (recolhível),
 * contas de demonstração na tela de login, diálogo de confirmação e modal de
 * exportação de dados.
 */
import { AlertTriangle, Check, ChevronDown, Copy, FlaskConical, LogIn, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useToast } from '@/components/toast';
import { Button, Modal } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { homeForRole } from '@/lib/session';
import { onDbEvent } from '../mock/db';
import { onUploadNotice } from '../mock/files';
import { getLocation, navigate, subscribe } from '../runtime/router';
import { closeConfirm, closeExport, getUiState, subscribeUi } from '../runtime/ui-store';

const PREF_KEY = 'personalpro.demo.banner';

function readPref(): 'open' | 'collapsed' {
  try {
    return window.localStorage.getItem(PREF_KEY) === 'collapsed' ? 'collapsed' : 'open';
  } catch {
    return 'open';
  }
}
function writePref(v: 'open' | 'collapsed') {
  try {
    window.localStorage.setItem(PREF_KEY, v);
  } catch {
    /* ignore */
  }
}

export const DEMO_ACCOUNTS = [
  { label: 'Professora', name: 'Carla Mendes', email: 'professor@demo.personalpro.app', password: 'Demo12345' },
  { label: 'Aluno', name: 'João Pereira', email: 'joao@demo.personalpro.app', password: 'Demo12345' },
  { label: 'Aluna', name: 'Ana Ribeiro', email: 'ana@demo.personalpro.app', password: 'Demo12345' },
  { label: 'Admin', name: 'Administrador', email: 'admin@personalpro.app', password: 'Admin12345' },
];

function DemoAccounts({ compact }: { compact?: boolean }) {
  const { login } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const enter = async (email: string, password: string) => {
    setBusy(email);
    try {
      const res = await login(email, password);
      navigate(homeForRole(res.user.role), { replace: true });
    } catch (e) {
      toast.error('Não foi possível entrar', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className={compact ? 'mt-2' : 'mt-3'}>
      <p className="text-[11px] font-semibold tracking-wider text-subtle uppercase">Entrar com uma conta de demonstração</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {DEMO_ACCOUNTS.map((a) => (
          <button
            key={a.email}
            type="button"
            disabled={!!busy}
            onClick={() => enter(a.email, a.password)}
            className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-2 text-left transition hover:border-accent disabled:opacity-60"
          >
            <LogIn className="size-3.5 shrink-0 text-accent-ink" />
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">{a.label}</span>
              <span className="block truncate text-[11px] text-muted">{a.name}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-subtle">
        Senha: <span className="font-mono">Demo12345</span> (admin: <span className="font-mono">Admin12345</span>) · código de professor para novos alunos:{' '}
        <span className="font-mono">DEMO01</span>
      </p>
    </div>
  );
}

export function DemoBanner({ onReset }: { onReset: () => void }) {
  const loc = useSyncExternalStore(subscribe, getLocation, getLocation);
  const [mode, setMode] = useState<'open' | 'collapsed'>(readPref);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const { user } = useAuth();
  const onAuthPage = !user && (loc.pathname === '/login' || loc.pathname === '/');
  const inShell = /^\/(professor|aluno|admin)(\/|$)/.test(loc.pathname);
  // Telas de chat ocupam a altura da janela: ali o aviso fica sempre recolhido.
  const fullHeight = /\/mensagens$/.test(loc.pathname) || (loc.hash === '#chat' && loc.pathname.startsWith('/professor/alunos/'));

  useEffect(() => {
    const a = onDbEvent((reason) => {
      if (reason === 'quota') setNotice('Não foi possível salvar no armazenamento do navegador: as alterações valem só nesta sessão.');
    });
    const b = onUploadNotice(() => setNotice('Arquivos de vídeo/áudio (ou grandes demais) ficam disponíveis apenas nesta sessão do navegador.'));
    return () => {
      a();
      b();
    };
  }, []);

  const set = (v: 'open' | 'collapsed') => {
    setMode(v);
    writePref(v);
  };

  return (
    <>
      {(mode === 'open' && !fullHeight) || onAuthPage ? (
        <div className={`demo-banner relative z-[45] border-b border-border bg-surface-2/95 px-4 py-2.5 text-sm backdrop-blur ${inShell ? 'lg:ml-[248px]' : ''}`} role="region" aria-label="Aviso de demonstração">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-3 gap-y-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-ink">
              <FlaskConical className="size-3.5" />
            </span>
            <p className="min-w-0 flex-1 text-[13px] leading-snug text-muted">
              <span className="font-semibold text-fg">Versão de demonstração</span> — os dados ficam salvos apenas neste navegador.
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" variant="secondary" onClick={() => setConfirmReset(true)} aria-label="Restaurar dados da demo" title="Restaurar dados da demo">
                <RotateCcw className="size-3.5" /> <span className={onAuthPage ? '' : 'hidden sm:inline'}>Restaurar dados da demo</span>
              </Button>
              {!onAuthPage && (
                <button type="button" onClick={() => set('collapsed')} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-fg" aria-label="Recolher aviso" title="Recolher">
                  <X className="size-4" />
                </button>
              )}
            </div>
            {notice && (
              <p className="flex w-full items-center gap-2 text-xs text-warning">
                <AlertTriangle className="size-3.5 shrink-0" /> {notice}
              </p>
            )}
            {onAuthPage && (
              <div className="w-full">
                <DemoAccounts />
              </div>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => set('open')}
          className={`demo-chip fixed z-[45] inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs font-semibold text-muted shadow-card backdrop-blur hover:text-fg ${fullHeight ? 'demo-chip--hide-mobile' : ''}`}
          aria-label="Mostrar aviso da demonstração"
        >
          <FlaskConical className="size-3.5 text-accent-ink" /> Demo <ChevronDown className="size-3 rotate-180" />
        </button>
      )}
      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Restaurar dados da demo?"
        description="Todas as alterações feitas neste navegador serão descartadas e você sairá da conta."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Voltar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmReset(false);
                onReset();
              }}
            >
              <RotateCcw className="size-4" /> Restaurar
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Os dados de exemplo (professora Carla, alunos João e Ana, treinos, avaliações e agenda) voltam ao estado inicial.</p>
      </Modal>
    </>
  );
}

const DESTRUCTIVE = /(excluir|descartar|remover|inativar|cancelar)/i;

export function DemoDialogs() {
  const ui = useSyncExternalStore(subscribeUi, getUiState, getUiState);
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const confirm = ui.confirm;
  const exp = ui.exportData;

  useEffect(() => setCopied(false), [exp?.id]);

  const copy = async () => {
    if (!exp) return;
    try {
      await navigator.clipboard.writeText(exp.json);
      setCopied(true);
      return;
    } catch {
      /* fallback abaixo */
    }
    try {
      textRef.current?.select();
      setCopied(document.execCommand('copy'));
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <Modal
        open={!!confirm}
        onClose={() => closeConfirm(false)}
        title="Confirmar ação"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => closeConfirm(false)}>
              Voltar
            </Button>
            <Button variant={confirm && DESTRUCTIVE.test(confirm.message) ? 'danger' : 'primary'} onClick={() => closeConfirm(true)} autoFocus>
              <Check className="size-4" /> Confirmar
            </Button>
          </>
        }
      >
        <p className="text-sm">{confirm?.message}</p>
      </Modal>
      <Modal
        open={!!exp}
        onClose={closeExport}
        title="Exportar meus dados"
        description={`Na demonstração o download fica desativado — copie o conteúdo de ${exp?.filename ?? 'exportação.json'}.`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeExport}>
              Fechar
            </Button>
            <Button onClick={copy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copiado!' : 'Copiar JSON'}
            </Button>
          </>
        }
      >
        <textarea
          ref={textRef}
          readOnly
          value={exp?.json ?? ''}
          className="h-[50dvh] w-full resize-none rounded-xl border border-border bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-fg outline-none"
          aria-label="Dados exportados em JSON"
        />
      </Modal>
    </>
  );
}
