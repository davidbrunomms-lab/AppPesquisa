/** Erros de domínio no mesmo formato da API real: { statusCode, code, message }. */
import type { DbUser } from './db';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string | string[],
    readonly code?: string,
    readonly error?: string,
  ) {
    super(Array.isArray(message) ? message.join(', ') : message);
    this.body = { statusCode: status, ...(code ? { code } : {}), message, ...(error ? { error } : {}) };
  }
  readonly body: Record<string, unknown>;
}

/** DomainError genérico → 422 (DomainErrorFilter). */
export const domain = (message: string, code = 'DOMAIN_ERROR') => new HttpError(422, message, code);
export const notFound = (entity: string) => new HttpError(404, `${entity} não encontrado(a)`, 'NOT_FOUND');
export const forbidden = (message = 'Acesso negado') => new HttpError(403, message, 'FORBIDDEN');
export const conflict = (message: string) => new HttpError(409, message, 'CONFLICT');
export const unauthorized = (message = 'Não autenticado') => new HttpError(401, message, 'UNAUTHORIZED');
export const planLimit = (message = 'Limite de alunos do plano atingido. Faça upgrade para cadastrar mais alunos.') =>
  new HttpError(402, message, 'PLAN_LIMIT');
/** ValidationPipe do Nest (400 com lista de mensagens). */
export const badRequest = (messages: string[]) => new HttpError(400, messages, undefined, 'Bad Request');
/** RolesGuard (ForbiddenException do Nest). */
export const roleForbidden = () => new HttpError(403, 'Seu perfil não tem permissão para esta ação', undefined, 'Forbidden');

export interface AuthUser {
  userId: string;
  role: DbUser['role'];
  trainerId: string | null;
  studentId: string | null;
}

export interface Req {
  method: string;
  path: string;
  query: URLSearchParams;
  body: Record<string, any>;
  form: FormData | null;
  user: AuthUser | null;
  params: Record<string, string>;
}

export function requireRole(req: Req, ...roles: AuthUser['role'][]): AuthUser {
  if (!req.user) throw unauthorized();
  if (roles.length && !roles.includes(req.user.role)) throw roleForbidden();
  return req.user;
}

export const qNum = (req: Req, key: string): number | undefined => {
  const v = req.query.get(key);
  if (v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export const qStr = (req: Req, key: string): string | undefined => {
  const v = req.query.get(key);
  return v === null || v === '' ? undefined : v;
};
