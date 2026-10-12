import { Module } from '@nestjs/common';
import { WorkoutsModule } from '../workouts/workouts.module';
import { DashboardService } from './application/dashboard.service';
import { DashboardController } from './presentation/dashboard.controller';

@Module({ imports: [WorkoutsModule], controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
