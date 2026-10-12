import { Body, Controller, Get, Headers, HttpCode, Param, Post, RawBodyRequest, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import type { Request } from 'express';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Public, Roles } from '../../../common/auth/decorators';
import { SubscriptionsService } from '../application/subscriptions.service';

class CheckoutDto {
  @ApiProperty({ example: 'PERSONAL_PRO' })
  @IsString()
  planCode: string;
}

@ApiTags('Assinaturas')
@Controller()
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Public()
  @Get('plans')
  plans() {
    return this.subscriptions.listPlans();
  }

  @ApiBearerAuth()
  @Roles('TRAINER')
  @Get('subscriptions/me')
  mine(@CurrentUser() user: AuthUser) {
    return this.subscriptions.getForTrainer(user.trainerId!);
  }

  @ApiBearerAuth()
  @Roles('TRAINER')
  @Post('subscriptions/checkout')
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.subscriptions.checkout(user.trainerId!, dto.planCode);
  }

  @ApiBearerAuth()
  @Roles('TRAINER')
  @Post('subscriptions/cancel')
  cancel(@CurrentUser() user: AuthUser) {
    return this.subscriptions.cancel(user.trainerId!);
  }

  /** Webhooks dos gateways (Stripe, Mercado Pago, Asaas). Autenticados por assinatura/token do provedor. */
  @Public()
  @Post('webhooks/payments/:provider')
  @HttpCode(200)
  webhook(
    @Param('provider') _provider: string,
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
  ) {
    return this.subscriptions.handleWebhook(headers, req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {})));
  }
}
