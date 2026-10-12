import { Controller, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser } from '../../../common/auth/decorators';
import { FILE_FOLDERS, FileFolder, FilesService } from '../application/files.service';

class UploadQuery {
  @ApiPropertyOptional({ enum: FILE_FOLDERS, default: 'documents' })
  @IsOptional()
  @IsIn(FILE_FOLDERS)
  folder: FileFolder = 'documents';
}

export const MAX_UPLOAD_BYTES = 150 * 1024 * 1024;

@ApiTags('Arquivos')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  /** Upload genérico (avatar, mídia de exercício, anexos de chat, documentos). */
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File, @Query() q: UploadQuery) {
    return this.files.upload(user.userId, file, q.folder);
  }
}
