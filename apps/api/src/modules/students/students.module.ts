import { Module } from '@nestjs/common';
import { InvitesModule } from '../invites/invites.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { StudentsService } from './application/students.service';
import { StudentsController } from './presentation/students.controller';

@Module({
  imports: [SubscriptionsModule, InvitesModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
