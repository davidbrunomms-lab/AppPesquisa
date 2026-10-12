import type { PaymentProvider } from '@prisma/client';

export interface CheckoutInput {
  trainerId: string;
  email: string;
  name: string;
  plan: { code: string; name: string; priceCents: number; currency: string; interval: 'MONTHLY' | 'YEARLY' };
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  /** URL para o professor concluir o pagamento (null quando ativado imediatamente). */
  checkoutUrl: string | null;
  providerSubscriptionId?: string;
  providerCustomerId?: string;
  /** true = assinatura pode ser ativada sem aguardar webhook (gateway manual). */
  activateNow: boolean;
}

/** Eventos normalizados de webhook, independentes do gateway. */
export type PaymentEvent =
  | {
      kind: 'subscription.activated';
      trainerId?: string;
      providerSubscriptionId: string;
      providerCustomerId?: string;
    }
  | {
      kind: 'payment.succeeded';
      providerSubscriptionId: string;
      providerPaymentId: string;
      amountCents: number;
      paidAt: Date;
    }
  | { kind: 'payment.failed'; providerSubscriptionId: string; providerPaymentId?: string; amountCents?: number }
  | { kind: 'subscription.canceled'; providerSubscriptionId: string };

/**
 * Porta de pagamentos. Implementações: manual, Stripe, Mercado Pago e Asaas.
 * Adicionar um gateway = implementar esta classe e registrá-la em PaymentsInfraModule.
 */
export abstract class PaymentGatewayPort {
  abstract readonly provider: PaymentProvider;
  abstract createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  abstract cancel(providerSubscriptionId: string): Promise<void>;
  abstract parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): Promise<PaymentEvent[]>;
}
