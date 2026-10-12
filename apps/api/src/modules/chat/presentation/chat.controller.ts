import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { MessageType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUrl, Length, Max, MaxLength, Min } from 'class-validator';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { ChatService } from '../application/chat.service';

class SendMessageDto {
  @ApiPropertyOptional({ enum: MessageType, default: MessageType.TEXT })
  @IsOptional()
  @IsEnum(MessageType)
  type: MessageType = MessageType.TEXT;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) content?: string;
  @ApiPropertyOptional({ description: 'URL retornada por POST /files' }) @IsOptional() @IsUrl({ require_tld: false }) attachmentUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) attachmentName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) attachmentMime?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isQuestion?: boolean;
}

class QuestionDto {
  @ApiProperty({ example: 'Posso trocar o leg press pelo hack?' }) @IsString() @Length(1, 4000) content: string;
}

class MessagesQuery {
  @ApiPropertyOptional({ description: 'Paginação: mensagens anteriores a esta data' }) @IsOptional() @IsDateString() before?: string;
  @ApiPropertyOptional({ default: 30 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 30;
}

class AttachmentCaption {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) content?: string;
}

@ApiTags('Chat')
@ApiBearerAuth()
@Roles('TRAINER', 'STUDENT')
@Controller('conversations')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.chat.conversations(user);
  }

  /** "Enviar dúvida ao professor" (aluno). */
  @Roles('STUDENT')
  @Post('question')
  question(@CurrentUser() user: AuthUser, @Body() dto: QuestionDto) {
    return this.chat.askQuestion(user, dto.content);
  }

  @Get(':id/messages')
  messages(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query() q: MessagesQuery) {
    return this.chat.messages(user, id, q.before, q.limit);
  }

  @Post(':id/messages')
  send(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendMessageDto) {
    return this.chat.send(user, id, dto);
  }

  /** Envia foto, vídeo, áudio ou arquivo (multipart, campo "file"). */
  @Post(':id/attachments')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, content: { type: 'string' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 150 * 1024 * 1024 } }))
  attachment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AttachmentCaption,
  ) {
    return this.chat.sendAttachment(user, id, file, dto.content);
  }

  @Post(':id/read')
  read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.markRead(user, id);
  }
}
