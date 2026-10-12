import { Module } from '@nestjs/common';
import { NotificationJobsService } from './application/notification-jobs.service';

@Module({ providers: [NotificationJobsService], exports: [NotificationJobsService] })
export class JobsModule {}
