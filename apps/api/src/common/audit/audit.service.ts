import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/** Trilha de auditoria (LGPD): login, exportação/exclusão de dados, mudanças sensíveis. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: { userId?: string | null; action: string; entity?: string; entityId?: string; ip?: string; metadata?: Prisma.InputJsonValue }) {
    try {
      await this.prisma.auditLog.create({ data: { ...entry, metadata: entry.metadata ?? {} } });
    } catch (error) {
      this.logger.warn(`Falha ao registrar auditoria: ${(error as Error).message}`);
    }
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
