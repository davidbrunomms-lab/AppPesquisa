import type { UserRole } from '@prisma/client';

/** Payload do access token (JWT). */
export interface JwtPayload {
  sub: string;
  role: UserRole;
  tid?: string; // trainer id
  sid?: string; // student id
}

/** Usuário autenticado disponível nos controllers via @CurrentUser(). */
export interface AuthUser {
  userId: string;
  role: UserRole;
  trainerId: string | null;
  studentId: string | null;
}
