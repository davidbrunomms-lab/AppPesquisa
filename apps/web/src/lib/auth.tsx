'use client';

import type { AuthResponse, PublicUser, RegisterRequest } from '@personalpro/shared';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setSessionExpiredHandler } from './api';
import { getSession, homeForRole, sessionFromAuth, setSession, subscribeSession, updateSessionUser } from './session';

interface AuthContextValue {
  /** false até ler o localStorage (evita redirecionar antes da hidratação). */
  ready: boolean;
  user: PublicUser | null;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (data: RegisterRequest) => Promise<AuthResponse>;
  applyAuth: (res: AuthResponse) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<PublicUser | null>(null);
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    setUser(getSession()?.user ?? null);
    setReady(true);
    const unsub = subscribeSession((s) => setUser(s?.user ?? null));
    setSessionExpiredHandler(() => {
      qc.clear();
      const here = window.location.pathname;
      if (!isPublicPath(here)) router.replace(`/login?next=${encodeURIComponent(here)}&expirada=1`);
    });
    // Valida a sessão e atualiza o usuário (nome/avatar podem ter mudado).
    if (getSession()) {
      api<PublicUser>('/auth/me')
        .then(updateSessionUser)
        .catch(() => undefined);
    }
    return unsub;
  }, [qc, router]);

  const applyAuth = useCallback(
    (res: AuthResponse) => {
      qc.clear();
      setSession(sessionFromAuth(res));
    },
    [qc],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: false });
      applyAuth(res);
      return res;
    },
    [applyAuth],
  );

  const register = useCallback(
    async (data: RegisterRequest) => {
      const res = await api<AuthResponse>('/auth/register', { method: 'POST', body: data, auth: false });
      applyAuth(res);
      return res;
    },
    [applyAuth],
  );

  const logout = useCallback(async () => {
    const s = getSession();
    if (s) {
      await api('/auth/logout', { method: 'POST', body: { refreshToken: s.refreshToken }, auth: false }).catch(() => undefined);
    }
    setSession(null);
    qc.clear();
    router.replace('/login');
  }, [qc, router]);

  const refreshUser = useCallback(async () => {
    const me = await api<PublicUser>('/auth/me');
    updateSessionUser(me);
  }, []);

  const value = useMemo(
    () => ({ ready, user, login, register, applyAuth, logout, refreshUser }),
    [ready, user, login, register, applyAuth, logout, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}

const PUBLIC_PREFIXES = ['/login', '/cadastro', '/esqueci-senha', '/redefinir-senha', '/convite', '/privacidade', '/termos'];
export const isPublicPath = (p: string) => p === '/' || PUBLIC_PREFIXES.some((x) => p.startsWith(x));

/**
 * Guarda de rota por perfil. Sem sessão → /login?next=…; perfil errado → painel
 * do próprio perfil.
 */
export function useRoleGuard(role: PublicUser['role']) {
  const { ready, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = ready && !!user && user.role === role;

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (user.role !== role) router.replace(homeForRole(user.role));
  }, [ready, user, role, router, pathname]);

  return { allowed, user };
}
