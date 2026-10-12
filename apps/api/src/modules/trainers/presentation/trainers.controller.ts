import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { TrainersService } from '../application/trainers.service';
import { ReviewDto, UpdateTrainerDto } from './trainers.dto';

@ApiTags('Professores')
@ApiBearerAuth()
@Controller('trainers')
export class TrainersController {
  constructor(private readonly trainers: TrainersService) {}

  /** Perfil completo do professor autenticado (com contagem de alunos e código de convite). */
  @Roles('TRAINER')
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.trainers.getMe(user.trainerId!);
  }

  @Roles('TRAINER')
  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateTrainerDto) {
    return this.trainers.updateMe(user.trainerId!, dto);
  }

  @Get(':id')
  profile(@Param('id', ParseUUIDPipe) id: string) {
    return this.trainers.publicProfile(id);
  }

  @Roles('STUDENT')
  @Post(':id/reviews')
  review(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto) {
    return this.trainers.review(user.studentId!, id, dto.rating, dto.comment);
  }
}
