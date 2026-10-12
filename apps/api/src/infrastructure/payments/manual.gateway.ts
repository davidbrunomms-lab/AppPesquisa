import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { CheckoutResult, PaymentGatewayPort } from './payment-gateway.port';

/** Cobrança fora da plataforma (Pix/boleto manual). O admin confirma os pagamentos. */
@Injectable()
export class ManualGateway extends PaymentGatewayPort {
  readonly provider = PaymentProvider.MANUAL;

  async createCheckout(): Promise<CheckoutResult> {
    return { checkoutUrl: null, activateNow: true };
  }

  async cancel(): Promise<void> {}

  async parseWebhook() {
    return [];
  }
}
