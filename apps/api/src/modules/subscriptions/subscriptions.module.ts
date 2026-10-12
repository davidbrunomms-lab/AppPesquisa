import { Module } from '@nestjs/common';
import { SubscriptionsService } from './application/subscriptions.service';
import { SubscriptionsController } from './presentation/subscriptions.controller';

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
