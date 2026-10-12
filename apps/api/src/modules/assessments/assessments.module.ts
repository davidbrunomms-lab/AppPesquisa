import { Module } from '@nestjs/common';
import { GoalsModule } from '../goals/goals.module';
import { AssessmentsService } from './application/assessments.service';
import { AssessmentsController } from './presentation/assessments.controller';

@Module({ imports: [GoalsModule], controllers: [AssessmentsController], providers: [AssessmentsService] })
export class AssessmentsModule {}
