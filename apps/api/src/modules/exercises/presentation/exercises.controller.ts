import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { ExercisesService } from '../application/exercises.service';
import { CreateExerciseDto, ListExercisesQuery, UpdateExerciseDto } from './exercises.dto';

@ApiTags('Biblioteca de exercícios')
@ApiBearerAuth()
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListExercisesQuery) {
    return this.exercises.list(user, q);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.exercises.get(user, id);
  }

  /** Exercício personalizado do professor. */
  @Roles('TRAINER')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExerciseDto) {
    return this.exercises.create(user.trainerId!, dto);
  }

  @Roles('TRAINER')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExerciseDto) {
    return this.exercises.update(user.trainerId!, id, dto);
  }

  @Roles('TRAINER')
  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.exercises.remove(user.trainerId!, id);
  }
}
