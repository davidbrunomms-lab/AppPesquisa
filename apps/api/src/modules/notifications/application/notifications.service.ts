import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { NotFoundError } from '../../../common/errors/domain-errors';
import { paginate, PaginationQuery } from '../../../common/utils/pagination';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { PushPort } from '../../../infrastructure/push/push.port';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Evita duplicidade em jobs (ex.: "inactivity:2026-10-12"). */
  dedupeKey?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushPort,
  ) {}

  /** Grava a notificação in-app e dispara push. Retorna null se for duplicada. */
  async notify(userId: string, input: NotifyInput) {
    let notification;
    try {
      notification = await this.prisma.notification.create({
        data: {
          userId,
          type: input.type,
          title: input.title,
          body: input.body,
          data: input.data ?? {},
          dedupeKey: input.dedupeKey,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null;
      throw error;
    }

    // Push é "best effort": falhas não quebram o fluxo de negócio.
    try {
      const devices = await this.prisma.deviceToken.findMany({ where: { userId }, select: { token: true } });
      const { invalidTokens } = await this.push.send(
        devices.map((d) => d.token),
        { title: input.title, body: input.body, data: { ...(input.data ?? {}), notificationId: notification.id, type: input.type } },
      );
      if (invalidTokens.length) await this.prisma.deviceToken.deleteMany({ where: { token: { in: invalidTokens } } });
      await this.prisma.notification.update({ where: { id: notification.id }, data: { sentAt: new Date() } });
    } catch (error) {
      this.logger.warn(`Falha ao enviar push: ${(error as Error).message}`);
    }
    return notification;
  }

  async list(userId: string, q: PaginationQuery & { unread?: boolean }) {
    const where: Prisma.NotificationWhereInput = { userId, ...(q.unread ? { readAt: null } : {}) };
    const [items, total, unread] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(q) }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, total, unread, page: q.page, pageSize: q.pageSize };
  }

  async markRead(userId: string, id: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (!count && !(await this.prisma.notification.findFirst({ where: { id, userId } }))) {
      throw new NotFoundError('Notificação');
    }
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }
}
