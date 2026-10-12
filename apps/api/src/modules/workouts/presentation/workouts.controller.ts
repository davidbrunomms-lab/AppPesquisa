import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { WorkoutsService } from '../application/workouts.service';
import { AssignWorkoutDto, ListWorkoutsQuery, SaveWorkoutDto } from './workouts.dto';

@ApiTags('Treinos')
@ApiBearerAuth()
@Controller()
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Roles('TRAINER')
  @Get('workouts')
  list(@CurrentUser() user: AuthUser, @Query() q: ListWorkoutsQuery) {
    return this.workouts.list(user.trainerId!, q);
  }

  @Roles('TRAINER')
  @Post('workouts')
  create(@CurrentUser() user: AuthUser, @Body() dto: SaveWorkoutDto) {
    return this.workouts.create(user.trainerId!, dto);
  }

  /** Fichas ativas do aluno autenticado. */
  @Roles('STUDENT')
  @Get('workouts/mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.workouts.forStudent(user);
  }

  /** Treino do dia do aluno autenticado. */
  @Roles('STUDENT')
  @Get('workouts/today')
  today(@CurrentUser() user: AuthUser) {
    return this.workouts.today(user.studentId!);
  }

  @Roles('TRAINER')
  @Get('students/:studentId/workouts')
  ofStudent(@CurrentUser() user: AuthUser, @Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.workouts.forStudent(user, studentId);
  }

  @Get('workouts/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.workouts.get(user, id);
  }

  @Roles('TRAINER')
  @Put('workouts/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveWorkoutDto) {
    return this.workouts.update(user.trainerId!, id, dto);
  }

  @Roles('TRAINER')
  @Delete('workouts/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.workouts.remove(user.trainerId!, id);
  }

  @Roles('TRAINER')
  @Post('workouts/:id/duplicate')
  duplicate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.workouts.duplicate(user.trainerId!, id);
  }

  @Roles('TRAINER')
  @Post('workouts/:id/assign')
  assign(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignWorkoutDto) {
    return this.workouts.assign(user.trainerId!, id, dto);
  }

  @Roles('TRAINER')
  @Delete('workouts/:id/assign/:studentId')
  @HttpCode(204)
  unassign(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.workouts.unassign(user.trainerId!, id, studentId);
  }
}
