import { Module } from '@nestjs/common';
import { TrainersService } from './application/trainers.service';
import { TrainersController } from './presentation/trainers.controller';

@Module({ controllers: [TrainersController], providers: [TrainersService], exports: [TrainersService] })
export class TrainersModule {}
