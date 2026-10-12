import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { SessionsService } from '../application/sessions.service';
import { FinishSessionDto, LogSetDto, SessionHistoryQuery, StartSessionDto } from './sessions.dto';

@ApiTags('Execução de treino')
@ApiBearerAuth()
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  /** INICIAR TREINO */
  @Roles('STUDENT')
  @Post()
  start(@CurrentUser() user: AuthUser, @Body() dto: StartSessionDto) {
    return this.sessions.start(user.studentId!, dto.workoutId);
  }

  /** Histórico de treinos (aluno: próprio; professor: informe studentId). */
  @Roles('STUDENT', 'TRAINER')
  @Get()
  history(@CurrentUser() user: AuthUser, @Query() q: SessionHistoryQuery) {
    return this.sessions.history(user, q);
  }

  @Roles('STUDENT', 'TRAINER')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessions.get(user, id);
  }

  /** CONCLUIR SÉRIE */
  @Roles('STUDENT')
  @Post(':id/sets')
  logSet(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LogSetDto) {
    return this.sessions.logSet(user.studentId!, id, dto);
  }

  @Roles('STUDENT')
  @Delete(':id/sets/:setId')
  @HttpCode(204)
  deleteSet(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('setId', ParseUUIDPipe) setId: string,
  ) {
    return this.sessions.deleteSet(user.studentId!, id, setId);
  }

  /** FINALIZAR TREINO */
  @Roles('STUDENT')
  @Post(':id/finish')
  finish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: FinishSessionDto) {
    return this.sessions.finish(user.studentId!, id, dto);
  }

  @Roles('STUDENT')
  @Post(':id/abandon')
  @HttpCode(204)
  abandon(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessions.abandon(user.studentId!, id);
  }
}
