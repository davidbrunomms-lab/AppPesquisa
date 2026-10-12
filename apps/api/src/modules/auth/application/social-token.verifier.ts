import { Injectable } from '@nestjs/common';
import { AuthProvider } from '@prisma/client';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AppConfig } from '../../../config/app-config';
import { UnauthorizedError } from '../../../common/errors/domain-errors';

export interface SocialProfile {
  provider: AuthProvider;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

/**
 * Valida ID tokens do Google e da Apple (assinatura via JWKS, issuer e audience).
 * Para usar Supabase Auth / Firebase Auth / Clerk basta adicionar um verificador equivalente.
 */
@Injectable()
export class SocialTokenVerifier {
  constructor(private readonly config: AppConfig) {}

  async verify(provider: AuthProvider, idToken: string): Promise<SocialProfile> {
    try {
      if (provider === AuthProvider.GOOGLE) {
        const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
          issuer: ['https://accounts.google.com', 'accounts.google.com'],
          audience: this.config.social.googleClientIds,
        });
        return {
          provider,
          providerUserId: String(payload.sub),
          email: String(payload.email),
          emailVerified: payload.email_verified === true,
          name: payload.name as string | undefined,
          picture: payload.picture as string | undefined,
        };
      }
      const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
        issuer: 'https://appleid.apple.com',
        audience: this.config.social.appleClientIds,
      });
      return {
        provider,
        providerUserId: String(payload.sub),
        email: String(payload.email),
        // A Apple envia "true"/"false" como string
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      };
    } catch {
      throw new UnauthorizedError('Token de login social inválido');
    }
  }
}
