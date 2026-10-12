import { DomainError } from '../../../common/errors/domain-errors';

/** Política de senha: mínimo 8 caracteres, com letras e números. */
export function assertStrongPassword(password: string): void {
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new DomainError('A senha deve ter ao menos 8 caracteres, com letras e números', 'WEAK_PASSWORD');
  }
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
