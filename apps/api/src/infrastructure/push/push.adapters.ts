import { Injectable, Logger } from '@nestjs/common';
import { importPKCS8, SignJWT } from 'jose';
import { AppConfig } from '../../config/app-config';
import { PushMessage, PushPort } from './push.port';

@Injectable()
export class ConsolePushAdapter extends PushPort {
  private readonly logger = new Logger('Push');
  async send(tokens: string[], message: PushMessage) {
    if (tokens.length) this.logger.log(`[${tokens.length} dispositivo(s)] ${message.title}: ${message.body}`);
    return { invalidTokens: [] };
  }
}

/**
 * Firebase Cloud Messaging — API HTTP v1.
 * Autentica com a conta de serviço (JWT assinado → access token OAuth2).
 */
@Injectable()
export class FcmPushAdapter extends PushPort {
  private readonly logger = new Logger('FCM');
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: AppConfig) {
    super();
  }

  async send(tokens: string[], message: PushMessage) {
    const invalidTokens: string[] = [];
    if (!tokens.length) return { invalidTokens };
    const accessToken = await this.getAccessToken();
    const url = `https://fcm.googleapis.com/v1/projects/${this.config.fcm.projectId}/messages:send`;

    await Promise.all(
      tokens.map(async (token) => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: message.title, body: message.body },
              data: message.data ?? {},
              apns: { payload: { aps: { sound: 'default' } } },
              android: { priority: 'high', notification: { sound: 'default' } },
            },
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          if (res.status === 404 || body.includes('UNREGISTERED') || body.includes('INVALID_ARGUMENT')) {
            invalidTokens.push(token);
          } else {
            this.logger.warn(`Falha FCM (${res.status}): ${body}`);
          }
        }
      }),
    );
    return { invalidTokens };
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) return this.accessToken.value;
    const { clientEmail, privateKey } = this.config.fcm;
    const key = await importPKCS8(privateKey, 'RS256');
    const now = Math.floor(Date.now() / 1000);
    const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(clientEmail)
      .setSubject(clientEmail)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    if (!res.ok) throw new Error(`Falha ao autenticar no FCM: ${res.status}`);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return json.access_token;
  }
}
