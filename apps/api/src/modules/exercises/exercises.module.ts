import { Module } from '@nestjs/common';
import { ExercisesService } from './application/exercises.service';
import { ExercisesController } from './presentation/exercises.controller';

@Module({ controllers: [ExercisesController], providers: [ExercisesService], exports: [ExercisesService] })
export class ExercisesModule {}
