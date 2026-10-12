/** Erros de domínio/aplicação, independentes de HTTP. Mapeados em DomainErrorFilter. */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly code = 'DOMAIN_ERROR',
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string) {
    super(`${entity} não encontrado(a)`, 'NOT_FOUND');
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Acesso negado') {
    super(message, 'FORBIDDEN');
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFLICT');
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Não autenticado') {
    super(message, 'UNAUTHORIZED');
  }
}

export class PlanLimitError extends DomainError {
  constructor(message = 'Limite de alunos do plano atingido. Faça upgrade para cadastrar mais alunos.') {
    super(message, 'PLAN_LIMIT');
  }
}
