import { Module } from '@nestjs/common';
import { GoalsModule } from '../goals/goals.module';
import { SessionsService } from './application/sessions.service';
import { SessionsController } from './presentation/sessions.controller';

@Module({ imports: [GoalsModule], controllers: [SessionsController], providers: [SessionsService], exports: [SessionsService] })
export class SessionsModule {}
