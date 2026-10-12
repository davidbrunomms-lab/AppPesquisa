import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { NotesService } from '../application/notes.service';

class CreateNoteDto {
  @ApiProperty({ example: 'Aluno relatou desconforto no ombro durante supino.' }) @IsString() @Length(1, 5000) content: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() pinned?: boolean;
}

class UpdateNoteDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 5000) content?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() pinned?: boolean;
}

@ApiTags('Anotações do professor')
@ApiBearerAuth()
@Roles('TRAINER')
@Controller()
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get('students/:studentId/notes')
  list(@CurrentUser() user: AuthUser, @Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.notes.list(user.trainerId!, studentId);
  }

  @Post('students/:studentId/notes')
  create(@CurrentUser() user: AuthUser, @Param('studentId', ParseUUIDPipe) studentId: string, @Body() dto: CreateNoteDto) {
    return this.notes.create(user.trainerId!, studentId, dto.content, dto.pinned);
  }

  @Patch('notes/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNoteDto) {
    return this.notes.update(user.trainerId!, id, dto);
  }

  @Delete('notes/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notes.remove(user.trainerId!, id);
  }
}
