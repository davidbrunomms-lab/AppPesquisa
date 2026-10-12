import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { AppConfig } from '../../config/app-config';
import { CheckoutInput, CheckoutResult, PaymentEvent, PaymentGatewayPort } from './payment-gateway.port';

/** Asaas — assinaturas com Pix, boleto ou cartão. */
@Injectable()
export class AsaasGateway extends PaymentGatewayPort {
  readonly provider = PaymentProvider.ASAAS;
  private readonly baseUrl = 'https://api.asaas.com/v3';

  constructor(private readonly config: AppConfig) {
    super();
  }

  private async api<T>(path: string, method: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}/${path}`, {
      method,
      headers: { access_token: this.config.payments.asaasApiKey, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!res.ok) throw new Error(`Asaas: ${json?.errors?.[0]?.description ?? res.status}`);
    return json as T;
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const customer = await this.api<{ id: string }>('customers', 'POST', {
      name: input.name,
      email: input.email,
      externalReference: input.trainerId,
    });
    const nextDueDate = new Date().toISOString().slice(0, 10);
    const subscription = await this.api<{ id: string }>('subscriptions', 'POST', {
      customer: customer.id,
      billingType: 'UNDEFINED',
      value: input.plan.priceCents / 100,
      nextDueDate,
      cycle: input.plan.interval === 'YEARLY' ? 'YEARLY' : 'MONTHLY',
      description: input.plan.name,
      externalReference: input.trainerId,
    });
    const payments = await this.api<{ data: { invoiceUrl: string }[] }>(`subscriptions/${subscription.id}/payments`, 'GET');
    return {
      checkoutUrl: payments.data[0]?.invoiceUrl ?? null,
      providerSubscriptionId: subscription.id,
      providerCustomerId: customer.id,
      activateNow: false,
    };
  }

  async cancel(providerSubscriptionId: string): Promise<void> {
    await this.api(`subscriptions/${providerSubscriptionId}`, 'DELETE');
  }

  async parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): Promise<PaymentEvent[]> {
    const expected = this.config.payments.asaasWebhookToken;
    const given = String(headers['asaas-access-token'] ?? '');
    if (!expected || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
      throw new Error('Token do webhook Asaas inválido');
    }
    const body = JSON.parse(rawBody.toString('utf8'));
    const payment = body.payment;
    if (!payment?.subscription) return [];
    switch (body.event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        return [
          { kind: 'subscription.activated', trainerId: payment.externalReference, providerSubscriptionId: payment.subscription },
          {
            kind: 'payment.succeeded',
            providerSubscriptionId: payment.subscription,
            providerPaymentId: payment.id,
            amountCents: Math.round(payment.value * 100),
            paidAt: new Date(payment.paymentDate ?? payment.confirmedDate ?? Date.now()),
          },
        ];
      case 'PAYMENT_OVERDUE':
        return [{ kind: 'payment.failed', providerSubscriptionId: payment.subscription, providerPaymentId: payment.id }];
      default:
        return [];
    }
  }
}
