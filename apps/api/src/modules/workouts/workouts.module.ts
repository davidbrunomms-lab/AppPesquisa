import { Module } from '@nestjs/common';
import { ExercisesModule } from '../exercises/exercises.module';
import { WorkoutsService } from './application/workouts.service';
import { WorkoutsController } from './presentation/workouts.controller';

@Module({
  imports: [ExercisesModule],
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}
