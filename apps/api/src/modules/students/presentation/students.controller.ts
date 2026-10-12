import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { StudentsService } from '../application/students.service';
import { CreateStudentDto, ListStudentsQuery, StudentProfileDto, UpdateLinkDto } from './students.dto';

@ApiTags('Alunos')
@ApiBearerAuth()
@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  /** Lista de alunos do professor, com busca e filtros. */
  @Roles('TRAINER')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListStudentsQuery) {
    return this.students.list(user.trainerId!, q);
  }

  /** Cadastro manual de aluno pelo professor. */
  @Roles('TRAINER')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStudentDto) {
    return this.students.createManual(user.trainerId!, dto);
  }

  @Roles('STUDENT')
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.students.detail(user, user.studentId!);
  }

  @Roles('STUDENT')
  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: StudentProfileDto) {
    return this.students.update(user, user.studentId!, dto);
  }

  @Roles('TRAINER', 'STUDENT')
  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.students.detail(user, id);
  }

  @Roles('TRAINER', 'STUDENT')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StudentProfileDto) {
    return this.students.update(user, id, dto);
  }

  /** Status do acompanhamento (ativo/inativo) e data de início. */
  @Roles('TRAINER')
  @Patch(':id/link')
  updateLink(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLinkDto) {
    return this.students.updateLink(user.trainerId!, id, dto);
  }
}
