/**
 * Entrada da demo estática do PersonalPro Web: instala a API simulada, o
 * roteador por hash e monta o app real (apps/web/src) no navegador.
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Providers } from '@/components/providers';
import { API_URL } from '@/lib/api';
import { setSession } from '@/lib/session';
import { DemoBanner, DemoDialogs } from './app/chrome';
import { RouterOutlet } from './app/outlet';
import { resetDb } from './mock/db';
import { installMockApi, setAppUrlResolver } from './mock/server';
import { demoAppUrl } from './runtime/globals';
import { navigate } from './runtime/router';

installMockApi(API_URL);
setAppUrlResolver(demoAppUrl);

try {
  document.documentElement.lang = 'pt-BR';
} catch {
  /* ignore */
}

/**
 * No frame de hospedagem a API de área de transferência pode ser negada; o app
 * chama navigator.clipboard?.writeText(...) sem tratar a rejeição. Aqui ela
 * ganha um fallback (execCommand) e nunca rejeita.
 */
function legacyCopy(text: string) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  } catch {
    /* sem área de transferência */
  }
}
try {
  const clip = navigator.clipboard;
  if (clip?.writeText) {
    const original = clip.writeText.bind(clip);
    Object.defineProperty(clip, 'writeText', {
      configurable: true,
      value: (text: string) => original(text).catch(() => legacyCopy(text)),
    });
  } else {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => legacyCopy(text), readText: async () => '' },
    });
  }
} catch {
  /* ignore */
}

function DemoApp() {
  const [generation, setGeneration] = useState(0);
  const reset = () => {
    resetDb();
    setSession(null);
    navigate('/login', { replace: true });
    setGeneration((g) => g + 1);
  };
  return (
    <Providers key={generation}>
      <div className="min-h-dvh bg-bg text-fg">
        <DemoBanner onReset={reset} />
        <RouterOutlet />
        <DemoDialogs />
      </div>
    </Providers>
  );
}

let el = document.getElementById('root');
if (!el) {
  el = document.createElement('div');
  el.id = 'root';
  document.body.appendChild(el);
}
createRoot(el).render(
  <StrictMode>
    <DemoApp />
  </StrictMode>,
);
