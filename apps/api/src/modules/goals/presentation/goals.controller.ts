import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GoalStatus } from '@prisma/client';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { GoalsService } from '../application/goals.service';
import { CreateGoalDto, UpdateGoalDto } from './goals.dto';

@ApiTags('Metas')
@ApiBearerAuth()
@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @ApiQuery({ name: 'studentId', required: false, description: 'Obrigatório para professores' })
  @ApiQuery({ name: 'status', required: false, enum: GoalStatus })
  @Roles('TRAINER', 'STUDENT')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('studentId') studentId?: string, @Query('status') status?: GoalStatus) {
    return this.goals.list(user, studentId, status);
  }

  @Roles('TRAINER')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGoalDto) {
    return this.goals.create(user.trainerId!, dto);
  }

  @Roles('TRAINER')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGoalDto) {
    return this.goals.update(user.trainerId!, id, dto);
  }

  @Roles('TRAINER')
  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.goals.remove(user.trainerId!, id);
  }
}
