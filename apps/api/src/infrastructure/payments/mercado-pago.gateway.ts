import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { AppConfig } from '../../config/app-config';
import { CheckoutInput, CheckoutResult, PaymentEvent, PaymentGatewayPort } from './payment-gateway.port';

/** Mercado Pago — Assinaturas (preapproval). */
@Injectable()
export class MercadoPagoGateway extends PaymentGatewayPort {
  readonly provider = PaymentProvider.MERCADO_PAGO;

  constructor(private readonly config: AppConfig) {
    super();
  }

  private async api<T>(path: string, init: { method: string; body?: unknown }): Promise<T> {
    const res = await fetch(`https://api.mercadopago.com/${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${this.config.payments.mercadoPagoAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    const json = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!res.ok) throw new Error(`Mercado Pago: ${json?.message ?? res.status}`);
    return json as T;
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const preapproval = await this.api<{ id: string; init_point: string }>('preapproval', {
      method: 'POST',
      body: {
        reason: input.plan.name,
        external_reference: input.trainerId,
        payer_email: input.email,
        back_url: input.successUrl,
        status: 'pending',
        auto_recurring: {
          frequency: input.plan.interval === 'YEARLY' ? 12 : 1,
          frequency_type: 'months',
          transaction_amount: input.plan.priceCents / 100,
          currency_id: input.plan.currency,
        },
      },
    });
    return { checkoutUrl: preapproval.init_point, providerSubscriptionId: preapproval.id, activateNow: false };
  }

  async cancel(providerSubscriptionId: string): Promise<void> {
    await this.api(`preapproval/${providerSubscriptionId}`, { method: 'PUT', body: { status: 'cancelled' } });
  }

  /** Notificações: consulta o recurso na API (fonte da verdade) em vez de confiar no corpo. */
  async parseWebhook(_headers: Record<string, string | string[] | undefined>, rawBody: Buffer): Promise<PaymentEvent[]> {
    const body = JSON.parse(rawBody.toString('utf8') || '{}');
    const id: string | undefined = body?.data?.id;
    if (!id) return [];
    if (body.type === 'subscription_preapproval') {
      const p = await this.api<{ id: string; status: string; external_reference: string }>(`preapproval/${id}`, { method: 'GET' });
      if (p.status === 'authorized') return [{ kind: 'subscription.activated', trainerId: p.external_reference, providerSubscriptionId: p.id }];
      if (p.status === 'cancelled') return [{ kind: 'subscription.canceled', providerSubscriptionId: p.id }];
      return [];
    }
    if (body.type === 'subscription_authorized_payment') {
      const pay = await this.api<{ id: number; preapproval_id: string; status: string; transaction_amount: number; last_modified?: string }>(
        `authorized_payments/${id}`,
        { method: 'GET' },
      );
      if (pay.status === 'processed') {
        return [
          {
            kind: 'payment.succeeded',
            providerSubscriptionId: pay.preapproval_id,
            providerPaymentId: String(pay.id),
            amountCents: Math.round(pay.transaction_amount * 100),
            paidAt: new Date(pay.last_modified ?? Date.now()),
          },
        ];
      }
      if (pay.status === 'recycling' || pay.status === 'cancelled') {
        return [{ kind: 'payment.failed', providerSubscriptionId: pay.preapproval_id, providerPaymentId: String(pay.id) }];
      }
    }
    return [];
  }
}
