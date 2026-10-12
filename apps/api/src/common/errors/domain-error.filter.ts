import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  PlanLimitError,
  UnauthorizedError,
} from './domain-errors';

const statusFor = (error: DomainError): number => {
  if (error instanceof NotFoundError) return HttpStatus.NOT_FOUND;
  if (error instanceof ForbiddenError) return HttpStatus.FORBIDDEN;
  if (error instanceof ConflictError) return HttpStatus.CONFLICT;
  if (error instanceof UnauthorizedError) return HttpStatus.UNAUTHORIZED;
  if (error instanceof PlanLimitError) return HttpStatus.PAYMENT_REQUIRED;
  return HttpStatus.UNPROCESSABLE_ENTITY;
};

@Catch(DomainError, Prisma.PrismaClientKnownRequestError)
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainErrorFilter.name);

  catch(error: DomainError | Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof DomainError) {
      const status = statusFor(error);
      return response.status(status).json({ statusCode: status, code: error.code, message: error.message });
    }
    // Erros conhecidos do Prisma
    if (error.code === 'P2002') {
      return response
        .status(HttpStatus.CONFLICT)
        .json({ statusCode: 409, code: 'CONFLICT', message: 'Registro já existe' });
    }
    if (error.code === 'P2025') {
      return response
        .status(HttpStatus.NOT_FOUND)
        .json({ statusCode: 404, code: 'NOT_FOUND', message: 'Registro não encontrado' });
    }
    if (error.code === 'P2003') {
      return response
        .status(HttpStatus.UNPROCESSABLE_ENTITY)
        .json({ statusCode: 422, code: 'INVALID_REFERENCE', message: 'Referência inválida' });
    }
    this.logger.error(error);
    return response.status(500).json({ statusCode: 500, message: 'Erro interno' });
  }
}
