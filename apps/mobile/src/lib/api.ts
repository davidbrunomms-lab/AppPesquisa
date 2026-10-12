import type { AuthResponse } from '@personalpro/shared';
import { Platform } from 'react-native';
import { API_URL } from './config';
import { localStore, secureStorage } from './storage';

/** Erro tipado da API: `status` HTTP, `code` de negócio (ex.: ROLE_REQUIRED) e mensagem PT-BR. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorMessage(error: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// Sessão (tokens)
// ---------------------------------------------------------------------------

const ACCESS_KEY = 'pp.accessToken';
const REFRESH_KEY = 'pp.refreshToken';
const USER_KEY = 'pp.user';

type Tokens = { accessToken: string; refreshToken: string };

let tokens: Tokens | null = null;
let refreshing: Promise<boolean> | null = null;
const expiredListeners = new Set<() => void>();
const tokenListeners = new Set<(accessToken: string | null) => void>();

export const session = {
  get accessToken() {
    return tokens?.accessToken ?? null;
  },
  get refreshToken() {
    return tokens?.refreshToken ?? null;
  },
  async load(): Promise<{ tokens: Tokens | null; user: AuthResponse['user'] | null }> {
    const [accessToken, refreshToken, user] = await Promise.all([
      secureStorage.get(ACCESS_KEY),
      secureStorage.get(REFRESH_KEY),
      localStore.getJson<AuthResponse['user']>(USER_KEY),
    ]);
    tokens = accessToken && refreshToken ? { accessToken, refreshToken } : null;
    return { tokens, user: tokens ? user : null };
  },
  async save(auth: Pick<AuthResponse, 'accessToken' | 'refreshToken'> & { user?: AuthResponse['user'] }) {
    tokens = { accessToken: auth.accessToken, refreshToken: auth.refreshToken };
    tokenListeners.forEach((l) => l(auth.accessToken));
    await Promise.all([
      secureStorage.set(ACCESS_KEY, auth.accessToken),
      secureStorage.set(REFRESH_KEY, auth.refreshToken),
      auth.user ? localStore.setJson(USER_KEY, auth.user) : Promise.resolve(),
    ]);
  },
  async saveUser(user: AuthResponse['user']) {
    await localStore.setJson(USER_KEY, user);
  },
  async clear() {
    tokens = null;
    tokenListeners.forEach((l) => l(null));
    await Promise.all([secureStorage.remove(ACCESS_KEY), secureStorage.remove(REFRESH_KEY), localStore.remove(USER_KEY)]);
  },
  /** Chamado quando o refresh falha (sessão expirada/revogada). */
  onExpired(listener: () => void) {
    expiredListeners.add(listener);
    return () => expiredListeners.delete(listener);
  },
  /** Notifica trocas de access token (usado pelo socket do chat). */
  onTokenChange(listener: (accessToken: string | null) => void) {
    tokenListeners.add(listener);
    return () => tokenListeners.delete(listener);
  },
};

/** Single-flight: várias requisições com 401 simultâneas compartilham um único refresh. */
async function refreshTokens(): Promise<boolean> {
  if (!tokens?.refreshToken) return false;
  if (!refreshing) {
    const refreshToken = tokens.refreshToken;
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          // 5xx/rede: mantém a sessão; 401/4xx: sessão inválida.
          if (res.status >= 400 && res.status < 500) {
            await session.clear();
            expiredListeners.forEach((l) => l());
          }
          return false;
        }
        const data = (await res.json()) as AuthResponse;
        await session.save(data);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

// ---------------------------------------------------------------------------
// Requisições
// ---------------------------------------------------------------------------

export type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  body?: unknown;
  query?: Query;
  form?: FormData;
  /** false para rotas públicas (login, cadastro…): não envia token nem tenta refresh. */
  auth?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Query) {
  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return params.length ? `${url}?${params.join('&')}` : url;
}

async function parseError(res: Response): Promise<ApiError> {
  let payload: { code?: string; message?: string | string[]; error?: string } | null = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  const raw = payload?.message;
  const message = Array.isArray(raw)
    ? raw.join('\n')
    : raw || defaultMessage(res.status);
  const code = payload?.code || (res.status === 400 ? 'VALIDATION' : `HTTP_${res.status}`);
  return new ApiError(res.status, code, message, payload);
}

function defaultMessage(status: number) {
  switch (status) {
    case 401:
      return 'Sua sessão expirou. Entre novamente.';
    case 402:
      return 'Limite do plano atingido ou assinatura inativa.';
    case 403:
      return 'Você não tem permissão para esta ação.';
    case 404:
      return 'Registro não encontrado.';
    case 429:
      return 'Muitas tentativas. Aguarde um instante e tente novamente.';
    default:
      return status >= 500 ? 'Erro no servidor. Tente novamente em instantes.' : 'Não foi possível concluir a ação.';
  }
}

export async function request<T>(method: string, path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const { body, query, form, auth = true, signal } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined && !form) headers['Content-Type'] = 'application/json';
  if (auth && tokens?.accessToken) headers.Authorization = `Bearer ${tokens.accessToken}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK', 'Sem conexão com o servidor. Verifique sua internet.');
  }

  if (res.status === 401 && auth && !retried && tokens?.refreshToken) {
    const ok = await refreshTokens();
    if (ok) return request<T>(method, path, options, true);
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, query?: Query, opts?: Omit<RequestOptions, 'query' | 'body'>) =>
    request<T>('GET', path, { ...opts, query }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>) => request<T>('POST', path, { ...opts, body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, { body }),
  upload: <T>(path: string, form: FormData, query?: Query) => request<T>('POST', path, { form, query }),
};

// ---------------------------------------------------------------------------
// Upload multipart (nativo: {uri,name,type}; web: Blob)
// ---------------------------------------------------------------------------

export interface LocalFile {
  uri: string;
  name: string;
  mimeType: string;
  /** Presente na web (ImagePicker/DocumentPicker). */
  file?: Blob | null;
}

export async function buildFileForm(file: LocalFile, extra?: Record<string, string>): Promise<FormData> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = file.file ?? (await (await fetch(file.uri)).blob());
    form.append('file', blob, file.name);
  } else {
    // React Native aceita { uri, name, type } como parte multipart.
    form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  }
  if (extra) Object.entries(extra).forEach(([k, v]) => form.append(k, v));
  return form;
}

export interface UploadedFile {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

export async function uploadFile(file: LocalFile, folder: 'avatars' | 'exercises' | 'chat' | 'progress' | 'documents') {
  return api.upload<UploadedFile>('/files', await buildFileForm(file), { folder });
}
