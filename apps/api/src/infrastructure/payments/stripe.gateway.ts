import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppConfig } from '../../config/app-config';
import { CheckoutInput, CheckoutResult, PaymentEvent, PaymentGatewayPort } from './payment-gateway.port';

const header = (h: Record<string, string | string[] | undefined>, name: string) => {
  const v = h[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
};

/** Stripe Checkout (assinaturas) + webhooks assinados. */
@Injectable()
export class StripeGateway extends PaymentGatewayPort {
  readonly provider = PaymentProvider.STRIPE;

  constructor(private readonly config: AppConfig) {
    super();
  }

  private async api<T>(path: string, body?: URLSearchParams, method = 'POST'): Promise<T> {
    const res = await fetch(`https://api.stripe.com/v1/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.payments.stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const json = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!res.ok) throw new Error(`Stripe: ${json?.error?.message ?? res.status}`);
    return json as T;
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const params = new URLSearchParams({
      mode: 'subscription',
      customer_email: input.email,
      client_reference_id: input.trainerId,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': input.plan.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(input.plan.priceCents),
      'line_items[0][price_data][recurring][interval]': input.plan.interval === 'YEARLY' ? 'year' : 'month',
      'line_items[0][price_data][product_data][name]': input.plan.name,
      'subscription_data[metadata][trainerId]': input.trainerId,
      'subscription_data[metadata][planCode]': input.plan.code,
    });
    const session = await this.api<{ url: string }>('checkout/sessions', params);
    return { checkoutUrl: session.url, activateNow: false };
  }

  async cancel(providerSubscriptionId: string): Promise<void> {
    await this.api(`subscriptions/${providerSubscriptionId}`, new URLSearchParams({ cancel_at_period_end: 'true' }));
  }

  async parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): Promise<PaymentEvent[]> {
    this.verifySignature(header(headers, 'stripe-signature'), rawBody);
    const event = JSON.parse(rawBody.toString('utf8'));
    const obj = event.data?.object ?? {};
    switch (event.type) {
      case 'checkout.session.completed':
        return obj.subscription
          ? [
              {
                kind: 'subscription.activated',
                trainerId: obj.client_reference_id,
                providerSubscriptionId: obj.subscription,
                providerCustomerId: obj.customer,
              },
            ]
          : [];
      case 'invoice.paid':
        return [
          {
            kind: 'payment.succeeded',
            providerSubscriptionId: obj.subscription,
            providerPaymentId: obj.id,
            amountCents: obj.amount_paid,
            paidAt: new Date((obj.status_transitions?.paid_at ?? event.created) * 1000),
          },
        ];
      case 'invoice.payment_failed':
        return [
          { kind: 'payment.failed', providerSubscriptionId: obj.subscription, providerPaymentId: obj.id, amountCents: obj.amount_due },
        ];
      case 'customer.subscription.deleted':
        return [{ kind: 'subscription.canceled', providerSubscriptionId: obj.id }];
      default:
        return [];
    }
  }

  /** Verificação "Stripe-Signature: t=...,v1=..." (HMAC-SHA256 de `${t}.${payload}`), tolerância de 5 min. */
  private verifySignature(signature: string | undefined, rawBody: Buffer) {
    const secret = this.config.payments.stripeWebhookSecret;
    if (!secret || !signature) throw new Error('Assinatura do webhook Stripe ausente');
    const parts = Object.fromEntries(signature.split(',').map((p) => p.split('=') as [string, string]));
    const timestamp = Number(parts.t);
    if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) throw new Error('Webhook Stripe expirado');
    const expected = createHmac('sha256', secret).update(`${parts.t}.${rawBody.toString('utf8')}`).digest('hex');
    const given = Buffer.from(parts.v1 ?? '', 'utf8');
    if (given.length !== expected.length || !timingSafeEqual(given, Buffer.from(expected, 'utf8'))) {
      throw new Error('Assinatura do webhook Stripe inválida');
    }
  }
}
