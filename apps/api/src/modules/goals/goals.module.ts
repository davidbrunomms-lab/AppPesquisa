import { Module } from '@nestjs/common';
import { GoalsService } from './application/goals.service';
import { GoalsController } from './presentation/goals.controller';

@Module({ controllers: [GoalsController], providers: [GoalsService], exports: [GoalsService] })
export class GoalsModule {}
