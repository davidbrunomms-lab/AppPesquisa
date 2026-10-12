import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { StatsQuery } from '../../sessions/presentation/sessions.dto';
import { ProgressService } from '../application/progress.service';

@ApiTags('Evolução')
@ApiBearerAuth()
@Roles('STUDENT', 'TRAINER')
@Controller('progress')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('stats')
  stats(@CurrentUser() user: AuthUser, @Query() q: StatsQuery) {
    return this.progress.stats(user, q.studentId, q.weeks);
  }

  @ApiQuery({ name: 'studentId', required: false })
  @Get('exercises')
  exercises(@CurrentUser() user: AuthUser, @Query('studentId') studentId?: string) {
    return this.progress.exercises(user, studentId);
  }

  @ApiQuery({ name: 'studentId', required: false })
  @Get('exercises/:exerciseId')
  exercise(
    @CurrentUser() user: AuthUser,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.progress.exercise(user, exerciseId, studentId);
  }

  @ApiQuery({ name: 'studentId', required: false })
  @Get('body')
  body(@CurrentUser() user: AuthUser, @Query('studentId') studentId?: string) {
    return this.progress.body(user, studentId);
  }
}
