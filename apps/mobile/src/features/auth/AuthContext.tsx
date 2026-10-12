import type { AuthResponse, PublicUser, RegisterRequest, UserRole } from '@personalpro/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, session } from '@/lib/api';
import { registerForPush, unregisterPush } from '@/lib/push';
import { queryClient } from '@/lib/query';
import { disconnectChatSocket } from '@/lib/socket';
import { localStore } from '@/lib/storage';

type Status = 'loading' | 'signedOut' | 'signedIn';

export interface SocialLoginInput {
  provider: 'GOOGLE' | 'APPLE';
  idToken: string;
  role?: 'STUDENT' | 'TRAINER';
  name?: string;
  inviteCode?: string;
  acceptTerms?: boolean;
}

interface AuthContextValue {
  status: Status;
  user: PublicUser | null;
  role: UserRole | null;
  login(email: string, password: string): Promise<AuthResponse>;
  register(input: RegisterRequest): Promise<AuthResponse>;
  socialLogin(input: SocialLoginInput): Promise<AuthResponse>;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
  /** Encerra a sessão local sem chamar a API (ex.: conta excluída). */
  clearLocalSession(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PENDING_INVITE_KEY = 'pp.pendingInvite';

/** Código de convite recebido por deep link antes do login. */
export const pendingInvite = {
  get: () => localStore.getJson<string>(PENDING_INVITE_KEY),
  set: (code: string) => localStore.setJson(PENDING_INVITE_KEY, code),
  clear: () => localStore.remove(PENDING_INVITE_KEY),
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<PublicUser | null>(null);

  const clearLocalSession = useCallback(async () => {
    disconnectChatSocket();
    await session.clear();
    queryClient.clear();
    setUser(null);
    setStatus('signedOut');
  }, []);

  // Restaura a sessão salva no aparelho.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const saved = await session.load();
      if (!saved.tokens) {
        if (mounted) setStatus('signedOut');
        return;
      }
      if (saved.user && mounted) {
        setUser(saved.user);
        setStatus('signedIn');
      }
      try {
        const me = await api.get<PublicUser>('/auth/me');
        if (!mounted) return;
        setUser(me);
        setStatus('signedIn');
        await session.saveUser(me);
        void registerForPush();
      } catch (e) {
        if (!mounted) return;
        if (e instanceof ApiError && e.status === 401) await clearLocalSession();
        else if (!saved.user) setStatus('signedOut');
      }
    })();
    const off = session.onExpired(() => {
      queryClient.clear();
      setUser(null);
      setStatus('signedOut');
    });
    return () => {
      mounted = false;
      off();
    };
  }, [clearLocalSession]);

  const handleAuth = useCallback(async (res: AuthResponse) => {
    await session.save(res);
    queryClient.clear();
    setUser(res.user);
    setStatus('signedIn');
    void registerForPush();
    return res;
  }, []);

  const login = useCallback(
    async (email: string, password: string) =>
      handleAuth(await api.post<AuthResponse>('/auth/login', { email: email.trim().toLowerCase(), password }, { auth: false })),
    [handleAuth],
  );

  const register = useCallback(
    async (input: RegisterRequest) => handleAuth(await api.post<AuthResponse>('/auth/register', input, { auth: false })),
    [handleAuth],
  );

  const socialLogin = useCallback(
    async (input: SocialLoginInput) => handleAuth(await api.post<AuthResponse>('/auth/social', input, { auth: false })),
    [handleAuth],
  );

  const logout = useCallback(async () => {
    await unregisterPush();
    const refreshToken = session.refreshToken;
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken }, { auth: false });
      } catch {
        // ignora — a sessão local é encerrada de qualquer forma
      }
    }
    await clearLocalSession();
  }, [clearLocalSession]);

  const refreshUser = useCallback(async () => {
    const me = await api.get<PublicUser>('/auth/me');
    setUser(me);
    await session.saveUser(me);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, role: user?.role ?? null, login, register, socialLogin, logout, refreshUser, clearLocalSession }),
    [status, user, login, register, socialLogin, logout, refreshUser, clearLocalSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
