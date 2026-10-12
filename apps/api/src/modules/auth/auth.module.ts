import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../../config/app-config';
import { InvitesModule } from '../invites/invites.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AuthService } from './application/auth.service';
import { SocialTokenVerifier } from './application/social-token.verifier';
import { AuthController } from './presentation/auth.controller';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        secret: config.jwt.accessSecret,
        signOptions: { expiresIn: config.jwt.accessTtl as unknown as number, issuer: 'personalpro' },
        verifyOptions: { issuer: 'personalpro' },
      }),
    }),
    InvitesModule,
    SubscriptionsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, SocialTokenVerifier],
  exports: [AuthService],
})
export class AuthModule {}
