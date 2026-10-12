import { Module } from '@nestjs/common';
import { ProgressService } from './application/progress.service';
import { ProgressController } from './presentation/progress.controller';

@Module({ controllers: [ProgressController], providers: [ProgressService], exports: [ProgressService] })
export class ProgressModule {}
