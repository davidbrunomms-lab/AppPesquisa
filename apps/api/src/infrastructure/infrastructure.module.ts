import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { AiPort } from './ai/ai.port';
import { OpenAiCompatibleAdapter, RulesOnlyAiAdapter } from './ai/ai.adapters';
import { ConsoleMailAdapter, SmtpMailAdapter } from './mail/mail.adapters';
import { MailPort } from './mail/mail.port';
import { AsaasGateway } from './payments/asaas.gateway';
import { ManualGateway } from './payments/manual.gateway';
import { MercadoPagoGateway } from './payments/mercado-pago.gateway';
import { PaymentGatewayPort } from './payments/payment-gateway.port';
import { StripeGateway } from './payments/stripe.gateway';
import { ConsolePushAdapter, FcmPushAdapter } from './push/push.adapters';
import { PushPort } from './push/push.port';
import { LocalStorageAdapter } from './storage/local-storage.adapter';
import { S3StorageAdapter } from './storage/s3-storage.adapter';
import { StoragePort } from './storage/storage.port';

/** Seleciona os adaptadores (portas → implementações) a partir da configuração. */
@Global()
@Module({
  providers: [
    {
      provide: StoragePort,
      inject: [AppConfig],
      useFactory: (c: AppConfig) => (c.storage.driver === 's3' ? new S3StorageAdapter(c) : new LocalStorageAdapter(c)),
    },
    {
      provide: MailPort,
      inject: [AppConfig],
      useFactory: (c: AppConfig) => (c.mail.smtpUrl ? new SmtpMailAdapter(c) : new ConsoleMailAdapter()),
    },
    {
      provide: PushPort,
      inject: [AppConfig],
      useFactory: (c: AppConfig) =>
        c.fcm.projectId && c.fcm.privateKey ? new FcmPushAdapter(c) : new ConsolePushAdapter(),
    },
    {
      provide: AiPort,
      inject: [AppConfig],
      useFactory: (c: AppConfig) =>
        c.ai.provider === 'openai-compatible' && c.ai.apiUrl ? new OpenAiCompatibleAdapter(c) : new RulesOnlyAiAdapter(),
    },
    {
      provide: PaymentGatewayPort,
      inject: [AppConfig],
      useFactory: (c: AppConfig) => {
        switch (c.payments.provider) {
          case 'stripe':
            return new StripeGateway(c);
          case 'mercado_pago':
            return new MercadoPagoGateway(c);
          case 'asaas':
            return new AsaasGateway(c);
          default:
            return new ManualGateway();
        }
      },
    },
  ],
  exports: [StoragePort, MailPort, PushPort, AiPort, PaymentGatewayPort],
})
export class InfrastructureModule {}
