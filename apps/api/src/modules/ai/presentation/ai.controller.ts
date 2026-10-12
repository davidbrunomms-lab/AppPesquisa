import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AiSuggestionStatus } from '@prisma/client';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { AiService } from '../application/ai.service';

@ApiTags('IA (sugestões ao professor)')
@ApiBearerAuth()
@Roles('TRAINER')
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @ApiQuery({ name: 'status', required: false, enum: AiSuggestionStatus })
  @ApiQuery({ name: 'studentId', required: false })
  @Get('suggestions')
  list(@CurrentUser() user: AuthUser, @Query('status') status?: AiSuggestionStatus, @Query('studentId') studentId?: string) {
    return this.ai.list(user.trainerId!, status, studentId);
  }

  /** Executa a análise agora (todos os alunos ou um aluno). */
  @ApiQuery({ name: 'studentId', required: false })
  @Post('analyze')
  analyze(@CurrentUser() user: AuthUser, @Query('studentId') studentId?: string) {
    return studentId ? this.ai.analyzeStudent(user.trainerId!, studentId) : this.ai.analyzeTrainer(user.trainerId!);
  }

  /** Aprovar = aplicar (progressão de carga) ou registrar como aceita. */
  @Post('suggestions/:id/approve')
  approve(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.ai.approve(user.trainerId!, id);
  }

  @Post('suggestions/:id/reject')
  reject(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.ai.reject(user.trainerId!, id);
  }
}
