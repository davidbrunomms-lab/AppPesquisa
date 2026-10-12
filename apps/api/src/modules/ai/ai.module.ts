import { Module } from '@nestjs/common';
import { AiService } from './application/ai.service';
import { AiController } from './presentation/ai.controller';

@Module({ controllers: [AiController], providers: [AiService], exports: [AiService] })
export class AiModule {}
