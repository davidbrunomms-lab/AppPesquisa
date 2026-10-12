import { Injectable, Logger } from '@nestjs/common';
import { DevicePlatform, LinkStatus } from '@prisma/client';
import { compare } from 'bcryptjs';
import { AuditService } from '../../../common/audit/audit.service';
import { EncryptionService } from '../../../common/crypto/encryption.service';
import { UnauthorizedError } from '../../../common/errors/domain-errors';
import { PaymentGatewayPort } from '../../../infrastructure/payments/payment-gateway.port';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { FilesService } from '../../files/application/files.service';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly files: FilesService,
    private readonly gateway: PaymentGatewayPort,
    private readonly encryption: EncryptionService,
  ) {}

  async update(userId: string, data: { name?: string; phone?: string; avatarUrl?: string; marketingOptIn?: boolean }) {
    const user = await this.prisma.user.update({ where: { id: userId }, data });
    return { id: user.id, name: user.name, phone: user.phone, avatarUrl: user.avatarUrl, marketingOptIn: user.marketingOptIn };
  }

  async registerDevice(userId: string, token: string, platform: DevicePlatform) {
    return this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  async removeDevice(userId: string, token: string) {
    await this.prisma.deviceToken.deleteMany({ where: { userId, token } });
  }

  /** LGPD art. 18, II e V — acesso e portabilidade: todos os dados pessoais em JSON. */
  async export(userId: string, ip?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        identities: { select: { provider: true, createdAt: true } },
        deviceTokens: { select: { platform: true, createdAt: true } },
        notifications: true,
        sentMessages: true,
        files: true,
        trainer: {
          include: {
            gyms: { include: { gym: true } },
            availability: true,
            students: { include: { student: { include: { user: { select: { name: true, email: true } } } } } },
            exercises: true,
            workouts: { include: { exercises: true } },
            notes: true,
            invites: true,
            subscription: { include: { plan: true, payments: true } },
            reviews: true,
          },
        },
        student: {
          include: {
            gym: true,
            trainers: true,
            workouts: { include: { workout: { include: { exercises: { include: { exercise: true } } } } } },
            sessions: { include: { sets: true } },
            assessments: { include: { measurements: true, photos: true } },
            goals: true,
            appointments: true,
            reviews: true,
            reports: true,
          },
        },
      },
    });
    const { passwordHash: _ph, ...safeUser } = user;
    if (safeUser.trainer) {
      safeUser.trainer.notes = safeUser.trainer.notes.map((n) => ({ ...n, content: this.encryption.decrypt(n.content) }));
    }
    await this.audit.log({ userId, action: 'lgpd.export', ip });
    return { exportedAt: new Date().toISOString(), format: 'personalpro-export/v1', data: safeUser };
  }

  /**
   * LGPD art. 18, VI — eliminação. Remove perfis e dados vinculados (cascata),
   * apaga arquivos do storage, revoga sessões e anonimiza o registro de usuário
   * (mantido apenas para integridade de mensagens já trocadas e auditoria).
   */
  async delete(userId: string, password: string | undefined, ip?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { trainer: { include: { subscription: true } }, student: true },
    });
    if (user.passwordHash && !(password && (await compare(password, user.passwordHash)))) {
      throw new UnauthorizedError('Confirme sua senha para excluir a conta');
    }

    const providerSubscriptionId = user.trainer?.subscription?.providerSubscriptionId;
    if (providerSubscriptionId) {
      try {
        await this.gateway.cancel(providerSubscriptionId);
      } catch (error) {
        this.logger.warn(`Falha ao cancelar assinatura no gateway: ${(error as Error).message}`);
      }
    }
    await this.files.deleteAllOwnedBy(userId);

    await this.prisma.$transaction(async (tx) => {
      if (user.trainer) {
        const trainerId = user.trainer.id;
        await tx.trainerStudent.updateMany({
          where: { trainerId },
          data: { status: LinkStatus.INACTIVE, endedAt: new Date() },
        });
        // Fichas saem primeiro (os itens referenciam exercícios com RESTRICT)
        await tx.workout.deleteMany({ where: { trainerId } });
        // Exercícios personalizados já executados por alunos são arquivados para preservar o histórico deles
        await tx.exercise.updateMany({
          where: { trainerId, sets: { some: {} } },
          data: { trainerId: null, archivedAt: new Date() },
        });
        await tx.trainer.delete({ where: { id: trainerId } });
      }
      if (user.student) await tx.student.delete({ where: { id: user.student.id } });
      await tx.authIdentity.deleteMany({ where: { userId } });
      await tx.deviceToken.deleteMany({ where: { userId } });
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted+${userId}@personalpro.invalid`,
          name: 'Conta excluída',
          phone: null,
          avatarUrl: null,
          passwordHash: null,
          marketingOptIn: false,
          deletedAt: new Date(),
        },
      });
    });
    await this.audit.log({ userId, action: 'lgpd.account_deleted', ip });
  }
}
