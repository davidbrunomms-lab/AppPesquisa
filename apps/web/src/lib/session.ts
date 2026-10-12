import type { AuthResponse, PublicUser } from '@personalpro/shared';

/**
 * Sessão persistida no navegador (localStorage). Mantém tokens + usuário e
 * notifica assinantes (AuthProvider, socket) a cada mudança.
 */
export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

const KEY = 'personalpro.session';
type Listener = (s: StoredSession | null) => void;

let current: StoredSession | null | undefined;
const listeners = new Set<Listener>();

function read(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function getSession(): StoredSession | null {
  if (current === undefined) current = read();
  return current;
}

export function setSession(next: StoredSession | null) {
  current = next;
  if (typeof window !== 'undefined') {
    try {
      if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
      else window.localStorage.removeItem(KEY);
    } catch {
      /* armazenamento indisponível (aba anônima) — sessão fica só em memória */
    }
  }
  listeners.forEach((l) => l(next));
}

export function sessionFromAuth(res: AuthResponse): StoredSession {
  return { accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user };
}

export function updateSessionUser(user: PublicUser) {
  const s = getSession();
  if (s) setSession({ ...s, user });
}

export function subscribeSession(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

if (typeof window !== 'undefined') {
  // Sincroniza logout/login entre abas.
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    current = read();
    listeners.forEach((l) => l(current ?? null));
  });
}

export function homeForRole(role: PublicUser['role'] | undefined | null): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'TRAINER') return '/professor';
  if (role === 'STUDENT') return '/aluno';
  return '/login';
}
