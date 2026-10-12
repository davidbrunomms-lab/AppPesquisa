import type { AuthResponse } from '@personalpro/shared';
import { getSession, sessionFromAuth, setSession } from './session';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333').replace(/\/$/, '');

/** Erro tipado da API: { statusCode, code?, message }. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details: string[];

  constructor(status: number, message: string | string[] | undefined, code?: string) {
    const list = Array.isArray(message) ? message : message ? [message] : [];
    super(list[0] ?? defaultMessage(status));
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = list;
  }
}

function defaultMessage(status: number) {
  if (status === 0) return 'Não foi possível conectar ao servidor. Verifique sua conexão.';
  if (status === 401) return 'Sua sessão expirou. Entre novamente.';
  if (status === 402) return 'Limite do plano atingido ou assinatura inativa.';
  if (status === 403) return 'Você não tem permissão para esta ação.';
  if (status === 404) return 'Registro não encontrado.';
  if (status === 429) return 'Muitas tentativas. Aguarde um instante e tente novamente.';
  if (status >= 500) return 'Erro inesperado no servidor. Tente novamente.';
  return 'Não foi possível concluir a operação.';
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.details.length > 1 ? err.details.join(' · ') : err.message;
  if (err instanceof Error) return err.message;
  return 'Erro inesperado.';
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  /** multipart/form-data (upload de arquivos). */
  form?: FormData;
  /** false = rota pública (sem Authorization e sem refresh). */
  auth?: boolean;
  signal?: AbortSignal;
}

export function buildUrl(path: string, query?: Query) {
  const url = new URL(path.startsWith('http') ? path : `${API_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

// ---------------------------------------------------------------------------
// Refresh single-flight (rotação de refresh token)
// ---------------------------------------------------------------------------

let refreshing: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn;
}

function readStoredAccessToken(): string | null {
  try {
    const raw = window.localStorage.getItem('personalpro.session');
    return raw ? (JSON.parse(raw).accessToken as string) : null;
  } catch {
    return null;
  }
}

/**
 * Troca o refresh token por um novo par. Chamadas concorrentes compartilham a
 * mesma promessa — reutilizar um refresh token já trocado revogaria todas as
 * sessões do usuário.
 */
export function refreshTokens(failedAccessToken?: string | null): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const session = getSession();
    if (!session) return null;
    // Outra aba já renovou? Adota o token mais novo em vez de reutilizar o refresh antigo.
    const stored = typeof window !== 'undefined' ? readStoredAccessToken() : null;
    if (stored && failedAccessToken && stored !== failedAccessToken) {
      try {
        const raw = window.localStorage.getItem('personalpro.session');
        if (raw) setSession(JSON.parse(raw));
        return stored;
      } catch {
        /* segue para o refresh */
      }
    }
    try {
      const res = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
      if (!res.ok) throw new ApiError(res.status, 'Sessão expirada');
      const data = (await res.json()) as AuthResponse;
      setSession(sessionFromAuth(data));
      return data.accessToken;
    } catch (err) {
      if (err instanceof ApiError) {
        setSession(null);
        onSessionExpired?.();
      }
      return null;
    }
  })().finally(() => {
    setTimeout(() => {
      refreshing = null;
    }, 0);
  });
  return refreshing;
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const data = await res.json();
    return new ApiError(res.status, data?.message, data?.code);
  } catch {
    return new ApiError(res.status, undefined);
  }
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, form, auth = true, signal } = opts;
  const doFetch = async (token: string | null) => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined && !form) headers['Content-Type'] = 'application/json';
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    return fetch(buildUrl(path, query), {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
    });
  };

  let token = auth ? getSession()?.accessToken ?? null : null;
  let res: Response;
  try {
    res = await doFetch(token);
    if (res.status === 401 && auth && token) {
      token = await refreshTokens(token);
      if (!token) throw new ApiError(401, 'Sua sessão expirou. Entre novamente.');
      res = await doFetch(token);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError(0, undefined);
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface UploadedFile {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

/** POST /files?folder=… → { url } */
export function uploadFile(file: File, folder: 'avatars' | 'exercises' | 'chat' | 'progress' | 'documents') {
  const form = new FormData();
  form.append('file', file);
  return api<UploadedFile>('/files', { method: 'POST', form, query: { folder } });
}

/** Baixa um recurso autenticado como arquivo (ex.: exportação LGPD). */
export async function downloadJson(path: string, filename: string) {
  const data = await api<unknown>(path);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
