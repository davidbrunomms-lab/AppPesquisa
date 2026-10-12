import { Module } from '@nestjs/common';
import { ScheduleService } from './application/schedule.service';
import { ScheduleController } from './presentation/schedule.controller';

@Module({ controllers: [ScheduleController], providers: [ScheduleService], exports: [ScheduleService] })
export class AgendaModule {}
