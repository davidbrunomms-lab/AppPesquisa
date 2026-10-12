import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { InvitesService } from './application/invites.service';
import { InvitesController } from './presentation/invites.controller';

@Module({
  imports: [SubscriptionsModule],
  controllers: [InvitesController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
