import { Injectable, Logger } from '@nestjs/common';
import { LinkStatus, NotificationType, PaymentStatus, Subscription, SubscriptionStatus } from '@prisma/client';
import { addDays, canAddStudent, TRIAL_DAYS } from '@personalpro/shared';
import { AppConfig } from '../../../config/app-config';
import { ConflictError, NotFoundError, PlanLimitError } from '../../../common/errors/domain-errors';
import { PaymentEvent, PaymentGatewayPort } from '../../../infrastructure/payments/payment-gateway.port';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../../notifications/application/notifications.service';

export const TRIAL_PLAN_CODE = 'PERSONAL_PRO';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGatewayPort,
    private readonly config: AppConfig,
    private readonly notifications: NotificationsService,
  ) {}

  listPlans() {
    return this.prisma.plan.findMany({ where: { active: true }, orderBy: { priceCents: 'asc' } });
  }

  /** Período de teste gratuito iniciado no cadastro do professor. */
  async startTrial(trainerId: string): Promise<Subscription | null> {
    const plan = await this.prisma.plan.findUnique({ where: { code: TRIAL_PLAN_CODE } });
    if (!plan) {
      this.logger.warn(`Plano de teste ${TRIAL_PLAN_CODE} não encontrado (rode o seed)`);
      return null;
    }
    return this.prisma.subscription.create({
      data: {
        trainerId,
        planId: plan.id,
        status: SubscriptionStatus.TRIALING,
        currentPeriodEnd: addDays(new Date(), TRIAL_DAYS),
      },
    });
  }

  isEntitled(sub: Pick<Subscription, 'status' | 'currentPeriodEnd'> | null): boolean {
    if (!sub) return false;
    if (sub.status === SubscriptionStatus.ACTIVE || sub.status === SubscriptionStatus.PAST_DUE) return true;
    return sub.status === SubscriptionStatus.TRIALING && sub.currentPeriodEnd > new Date();
  }

  async getForTrainer(trainerId: string) {
    const [subscription, studentsInUse] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: { trainerId },
        include: { plan: true, payments: { orderBy: { createdAt: 'desc' }, take: 12 } },
      }),
      this.countSeats(trainerId),
    ]);
    return {
      subscription,
      entitled: this.isEntitled(subscription),
      usage: { students: studentsInUse, maxStudents: subscription?.plan.maxStudents ?? 0 },
    };
  }

  private countSeats(trainerId: string) {
    return this.prisma.trainerStudent.count({
      where: { trainerId, status: { in: [LinkStatus.ACTIVE, LinkStatus.PENDING] } },
    });
  }

  /** Regra do plano: número de alunos ativos/pendentes ≤ max_students. */
  async assertCanAddStudent(trainerId: string): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({ where: { trainerId }, include: { plan: true } });
    if (!this.isEntitled(sub)) {
      throw new PlanLimitError('Sua assinatura não está ativa. Escolha um plano para cadastrar alunos.');
    }
    if (!canAddStudent(await this.countSeats(trainerId), sub!.plan.maxStudents)) throw new PlanLimitError();
  }

  async checkout(trainerId: string, planCode: string) {
    const [plan, trainer] = await Promise.all([
      this.prisma.plan.findFirst({ where: { code: planCode, active: true } }),
      this.prisma.trainer.findUniqueOrThrow({ where: { id: trainerId }, include: { user: true } }),
    ]);
    if (!plan) throw new NotFoundError('Plano');
    const seats = await this.countSeats(trainerId);
    if (!canAddStudent(seats - 1, plan.maxStudents)) {
      throw new ConflictError(`Você possui ${seats} alunos ativos; o plano ${plan.name} permite ${plan.maxStudents}.`);
    }

    const result = await this.gateway.createCheckout({
      trainerId,
      email: trainer.user.email,
      name: trainer.user.name,
      plan: { code: plan.code, name: plan.name, priceCents: plan.priceCents, currency: plan.currency, interval: plan.interval },
      successUrl: `${this.config.appUrl}/professor/assinatura?status=sucesso`,
      cancelUrl: `${this.config.appUrl}/professor/assinatura?status=cancelado`,
    });

    const periodEnd = addDays(new Date(), plan.interval === 'YEARLY' ? 365 : 30);
    const data = {
      planId: plan.id,
      provider: this.gateway.provider,
      providerSubscriptionId: result.providerSubscriptionId ?? null,
      providerCustomerId: result.providerCustomerId ?? null,
      cancelAtPeriodEnd: false,
      ...(result.activateNow
        ? { status: SubscriptionStatus.ACTIVE, currentPeriodStart: new Date(), currentPeriodEnd: periodEnd }
        : {}),
    };
    const subscription = await this.prisma.subscription.upsert({
      where: { trainerId },
      create: {
        trainerId,
        status: result.activateNow ? SubscriptionStatus.ACTIVE : SubscriptionStatus.TRIALING,
        currentPeriodEnd: result.activateNow ? periodEnd : new Date(),
        ...data,
      },
      update: data,
      include: { plan: true },
    });
    if (result.activateNow) {
      await this.prisma.payment.create({
        data: { subscriptionId: subscription.id, provider: this.gateway.provider, amountCents: plan.priceCents, currency: plan.currency },
      });
    }
    return { checkoutUrl: result.checkoutUrl, subscription };
  }

  async cancel(trainerId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { trainerId } });
    if (!sub) throw new NotFoundError('Assinatura');
    if (sub.providerSubscriptionId) await this.gateway.cancel(sub.providerSubscriptionId);
    return this.prisma.subscription.update({ where: { trainerId }, data: { cancelAtPeriodEnd: true } });
  }

  /** Processa webhooks normalizados do gateway configurado (idempotente). */
  async handleWebhook(headers: Record<string, string | string[] | undefined>, rawBody: Buffer) {
    const events = await this.gateway.parseWebhook(headers, rawBody);
    for (const event of events) await this.apply(event);
    return { received: events.length };
  }

  private async apply(event: PaymentEvent) {
    const findSub = async (providerSubscriptionId: string, trainerId?: string) =>
      (await this.prisma.subscription.findUnique({ where: { providerSubscriptionId } })) ??
      (trainerId ? await this.prisma.subscription.findUnique({ where: { trainerId } }) : null);

    switch (event.kind) {
      case 'subscription.activated': {
        const sub = await findSub(event.providerSubscriptionId, event.trainerId);
        if (!sub) return this.logger.warn(`Assinatura não encontrada: ${event.providerSubscriptionId}`);
        const plan = await this.prisma.plan.findUniqueOrThrow({ where: { id: sub.planId } });
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: SubscriptionStatus.ACTIVE,
            provider: this.gateway.provider,
            providerSubscriptionId: event.providerSubscriptionId,
            providerCustomerId: event.providerCustomerId ?? sub.providerCustomerId,
            currentPeriodStart: new Date(),
            currentPeriodEnd: addDays(new Date(), plan.interval === 'YEARLY' ? 365 : 30),
          },
        });
        return;
      }
      case 'payment.succeeded': {
        const sub = await findSub(event.providerSubscriptionId);
        if (!sub) return;
        const plan = await this.prisma.plan.findUniqueOrThrow({ where: { id: sub.planId } });
        await this.prisma.$transaction([
          this.prisma.payment.upsert({
            where: { providerPaymentId: event.providerPaymentId },
            create: {
              subscriptionId: sub.id,
              provider: this.gateway.provider,
              providerPaymentId: event.providerPaymentId,
              amountCents: event.amountCents,
              status: PaymentStatus.PAID,
              paidAt: event.paidAt,
            },
            update: { status: PaymentStatus.PAID, paidAt: event.paidAt },
          }),
          this.prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: SubscriptionStatus.ACTIVE,
              currentPeriodStart: event.paidAt,
              currentPeriodEnd: addDays(event.paidAt, plan.interval === 'YEARLY' ? 365 : 30),
            },
          }),
        ]);
        return;
      }
      case 'payment.failed': {
        const sub = await findSub(event.providerSubscriptionId);
        if (!sub) return;
        await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: SubscriptionStatus.PAST_DUE } });
        if (event.providerPaymentId) {
          await this.prisma.payment.upsert({
            where: { providerPaymentId: event.providerPaymentId },
            create: {
              subscriptionId: sub.id,
              provider: this.gateway.provider,
              providerPaymentId: event.providerPaymentId,
              amountCents: event.amountCents ?? 0,
              status: PaymentStatus.FAILED,
            },
            update: { status: PaymentStatus.FAILED },
          });
        }
        const trainer = await this.prisma.trainer.findUniqueOrThrow({ where: { id: sub.trainerId } });
        await this.notifications.notify(trainer.userId, {
          type: NotificationType.SYSTEM,
          title: 'Falha no pagamento',
          body: 'Não conseguimos processar o pagamento da sua assinatura. Atualize sua forma de pagamento.',
        });
        return;
      }
      case 'subscription.canceled': {
        const sub = await findSub(event.providerSubscriptionId);
        if (!sub) return;
        await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: SubscriptionStatus.CANCELED } });
        return;
      }
    }
  }
}
