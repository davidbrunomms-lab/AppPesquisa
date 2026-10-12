import { createHmac } from 'node:crypto';
import { AppConfig } from '../../config/app-config';
import { StripeGateway } from './stripe.gateway';

const secret = 'whsec_test';
const gateway = new StripeGateway({ payments: { stripeWebhookSecret: secret, stripeSecretKey: 'sk' } } as unknown as AppConfig);

const sign = (body: string, t = Math.floor(Date.now() / 1000)) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;

describe('StripeGateway.parseWebhook', () => {
  const body = JSON.stringify({
    type: 'invoice.paid',
    created: 1790000000,
    data: { object: { id: 'in_1', subscription: 'sub_1', amount_paid: 9990, status_transitions: { paid_at: 1790000000 } } },
  });

  it('aceita assinatura válida e normaliza o evento', async () => {
    const events = await gateway.parseWebhook({ 'stripe-signature': sign(body) }, Buffer.from(body));
    expect(events).toEqual([
      expect.objectContaining({ kind: 'payment.succeeded', providerSubscriptionId: 'sub_1', amountCents: 9990 }),
    ]);
  });

  it('rejeita assinatura inválida', async () => {
    await expect(gateway.parseWebhook({ 'stripe-signature': sign('outro') }, Buffer.from(body))).rejects.toThrow();
  });

  it('rejeita evento antigo (replay)', async () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    await expect(gateway.parseWebhook({ 'stripe-signature': sign(body, old) }, Buffer.from(body))).rejects.toThrow();
  });
});
