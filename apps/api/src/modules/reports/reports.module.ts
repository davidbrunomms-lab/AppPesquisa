import { Module } from '@nestjs/common';
import { ReportsService } from './application/reports.service';
import { ReportsController } from './presentation/reports.controller';

@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
