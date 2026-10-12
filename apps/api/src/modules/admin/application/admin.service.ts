import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma, SessionStatus, SubscriptionStatus, UserRole } from '@prisma/client';
import { addDays, toDateKey } from '@personalpro/shared';
import { AuditService } from '../../../common/audit/audit.service';
import { NotFoundError } from '../../../common/errors/domain-errors';
import { paginate, PaginationQuery } from '../../../common/utils/pagination';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

/**
 * Painel administrativo: somente métricas agregadas e dados cadastrais.
 * Conteúdo privado (mensagens, anotações, avaliações) não é exposto.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async metrics() {
    const now = new Date();
    const d30 = addDays(now, -30);
    const yearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const notDeleted = { deletedAt: null };

    const [trainers, students, activeUsers, newUsers, workouts30, subsByStatus, activeSubs, payments30, paymentsYear, signupsRaw, workoutsRaw] =
      await Promise.all([
        this.prisma.user.count({ where: { role: UserRole.TRAINER, ...notDeleted } }),
        this.prisma.user.count({ where: { role: UserRole.STUDENT, ...notDeleted } }),
        this.prisma.user.count({ where: { lastLoginAt: { gte: d30 }, ...notDeleted } }),
        this.prisma.user.count({ where: { createdAt: { gte: d30 }, ...notDeleted } }),
        this.prisma.workoutSession.count({ where: { status: SessionStatus.COMPLETED, startedAt: { gte: d30 } } }),
        this.prisma.subscription.groupBy({ by: ['status'], _count: true }),
        this.prisma.subscription.findMany({ where: { status: SubscriptionStatus.ACTIVE }, include: { plan: true } }),
        this.prisma.payment.aggregate({ where: { status: PaymentStatus.PAID, paidAt: { gte: d30 } }, _sum: { amountCents: true } }),
        this.prisma.payment.findMany({ where: { status: PaymentStatus.PAID, paidAt: { gte: yearAgo } }, select: { amountCents: true, paidAt: true } }),
        this.prisma.user.findMany({ where: { createdAt: { gte: d30 } }, select: { createdAt: true, role: true } }),
        this.prisma.workoutSession.findMany({ where: { status: SessionStatus.COMPLETED, startedAt: { gte: d30 } }, select: { startedAt: true } }),
      ]);

    const days = Array.from({ length: 30 }, (_, i) => toDateKey(addDays(now, -29 + i)));
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}`;
    });
    const mrrCents = activeSubs.reduce(
      (acc, s) => acc + (s.plan.interval === 'YEARLY' ? Math.round(s.plan.priceCents / 12) : s.plan.priceCents),
      0,
    );
    const byPlan = new Map<string, number>();
    for (const s of activeSubs) byPlan.set(s.plan.name, (byPlan.get(s.plan.name) ?? 0) + 1);

    return {
      totals: { trainers, students, activeUsers30d: activeUsers, newSignups30d: newUsers, workouts30d: workouts30 },
      subscriptions: {
        byStatus: Object.fromEntries(subsByStatus.map((s) => [s.status, s._count])),
        activeByPlan: Object.fromEntries(byPlan),
      },
      revenue: {
        mrrCents,
        last30dCents: payments30._sum.amountCents ?? 0,
        monthly: months.map((m) => ({
          month: m,
          amountCents: paymentsYear.filter((p) => p.paidAt && toDateKey(p.paidAt).startsWith(m)).reduce((a, p) => a + p.amountCents, 0),
        })),
      },
      series: {
        signups: days.map((d) => ({
          date: d,
          trainers: signupsRaw.filter((u) => u.role === UserRole.TRAINER && toDateKey(u.createdAt) === d).length,
          students: signupsRaw.filter((u) => u.role === UserRole.STUDENT && toDateKey(u.createdAt) === d).length,
        })),
        workouts: days.map((d) => ({ date: d, count: workoutsRaw.filter((w) => toDateKey(w.startedAt) === d).length })),
      },
    };
  }

  async users(q: PaginationQuery & { role?: UserRole; search?: string }) {
    const where: Prisma.UserWhereInput = {
      role: q.role,
      ...(q.search
        ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          lastLoginAt: true,
          deletedAt: true,
          trainer: { select: { id: true, cref: true, _count: { select: { students: true } }, subscription: { select: { status: true, plan: { select: { name: true } } } } } },
        },
        orderBy: { createdAt: 'desc' },
        ...paginate(q),
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  subscriptions(status?: SubscriptionStatus) {
    return this.prisma.subscription.findMany({
      where: { status },
      include: {
        plan: true,
        trainer: { include: { user: { select: { name: true, email: true } }, _count: { select: { students: true } } } },
        payments: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  plans() {
    return this.prisma.plan.findMany({ orderBy: { priceCents: 'asc' }, include: { _count: { select: { subscriptions: true } } } });
  }

  createPlan(data: Prisma.PlanCreateInput) {
    return this.prisma.plan.create({ data });
  }

  updatePlan(id: string, data: Prisma.PlanUpdateInput) {
    return this.prisma.plan.update({ where: { id }, data });
  }

  /** Confirmação manual de pagamento (Pix/boleto fora do gateway). */
  async registerManualPayment(adminUserId: string, subscriptionId: string, amountCents: number) {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId }, include: { plan: true } });
    if (!sub) throw new NotFoundError('Assinatura');
    const paidAt = new Date();
    const [payment] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: { subscriptionId, provider: 'MANUAL', amountCents, status: PaymentStatus.PAID, paidAt },
      }),
      this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: paidAt,
          currentPeriodEnd: addDays(paidAt, sub.plan.interval === 'YEARLY' ? 365 : 30),
        },
      }),
    ]);
    await this.audit.log({ userId: adminUserId, action: 'admin.manual_payment', entity: 'subscription', entityId: subscriptionId, metadata: { amountCents } });
    return payment;
  }
}
