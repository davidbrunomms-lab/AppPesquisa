import { Injectable } from '@nestjs/common';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return value;
};

const optional = (name: string, fallback = ''): string => process.env[name] ?? fallback;
const list = (name: string): string[] =>
  optional(name)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

/** Configuração tipada e validada no boot (falha rápido se algo obrigatório faltar). */
@Injectable()
export class AppConfig {
  readonly nodeEnv = optional('NODE_ENV', 'development');
  readonly isProduction = this.nodeEnv === 'production';
  readonly port = Number(optional('PORT', '3333'));
  readonly appUrl = optional('APP_URL', 'http://localhost:3000');
  readonly publicApiUrl = optional('PUBLIC_API_URL', `http://localhost:${optional('PORT', '3333')}`);
  readonly corsOrigins = list('CORS_ORIGINS');

  readonly jwt = {
    accessSecret: required('JWT_ACCESS_SECRET'),
    accessTtl: optional('JWT_ACCESS_TTL', '15m'),
    refreshTtlDays: Number(optional('JWT_REFRESH_TTL_DAYS', '30')),
  };

  readonly encryptionKey = optional('DATA_ENCRYPTION_KEY');

  readonly social = {
    googleClientIds: list('GOOGLE_CLIENT_IDS'),
    appleClientIds: list('APPLE_CLIENT_IDS'),
  };

  readonly mail = {
    smtpUrl: optional('SMTP_URL'),
    from: optional('MAIL_FROM', 'PersonalPro <no-reply@personalpro.app>'),
  };

  readonly storage = {
    driver: optional('STORAGE_DRIVER', 'local') as 'local' | 's3',
    localDir: optional('STORAGE_LOCAL_DIR', './uploads'),
    s3: {
      bucket: optional('S3_BUCKET'),
      region: optional('S3_REGION', 'us-east-1'),
      endpoint: optional('S3_ENDPOINT'),
      accessKeyId: optional('S3_ACCESS_KEY_ID'),
      secretAccessKey: optional('S3_SECRET_ACCESS_KEY'),
      publicUrl: optional('S3_PUBLIC_URL'),
    },
  };

  readonly fcm = {
    projectId: optional('FCM_PROJECT_ID'),
    clientEmail: optional('FCM_CLIENT_EMAIL'),
    privateKey: optional('FCM_PRIVATE_KEY').replace(/\\n/g, '\n'),
  };

  readonly ai = {
    provider: optional('AI_PROVIDER', 'rules'),
    apiUrl: optional('AI_API_URL'),
    apiKey: optional('AI_API_KEY'),
    model: optional('AI_MODEL'),
  };

  readonly payments = {
    provider: optional('PAYMENT_PROVIDER', 'manual'),
    stripeSecretKey: optional('STRIPE_SECRET_KEY'),
    stripeWebhookSecret: optional('STRIPE_WEBHOOK_SECRET'),
    mercadoPagoAccessToken: optional('MERCADO_PAGO_ACCESS_TOKEN'),
    asaasApiKey: optional('ASAAS_API_KEY'),
    asaasWebhookToken: optional('ASAAS_WEBHOOK_TOKEN'),
  };

  constructor() {
    if (this.isProduction) {
      if (this.jwt.accessSecret.length < 32) throw new Error('JWT_ACCESS_SECRET deve ter ao menos 32 caracteres');
      if (!this.encryptionKey) throw new Error('DATA_ENCRYPTION_KEY é obrigatória em produção');
    }
  }
}
