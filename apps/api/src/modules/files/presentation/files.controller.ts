import { Controller, Get, NotFoundException, Param, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiExcludeEndpoint, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import type { Response } from 'express';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Public } from '../../../common/auth/decorators';
import { LocalStorageAdapter } from '../../../infrastructure/storage/local-storage.adapter';
import { StoragePort } from '../../../infrastructure/storage/storage.port';
import { FILE_FOLDERS, FileFolder, FilesService } from '../application/files.service';


class UploadQuery {
  @ApiPropertyOptional({ enum: FILE_FOLDERS, default: 'documents' })
  @IsOptional()
  @IsIn(FILE_FOLDERS)
  folder: FileFolder = 'documents';
}

export const MAX_UPLOAD_BYTES = 150 * 1024 * 1024;

@ApiTags('Arquivos')
@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly storage: StoragePort,
  ) {}

  /**
   * Upload genérico. "avatars" e "exercises" geram URL pública; "chat", "progress"
   * e "documents" são privados e retornam URL assinada válida por 1 hora.
   */
  @ApiBearerAuth()
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File, @Query() q: UploadQuery) {
    return this.files.upload(user.userId, file, q.folder);
  }

  /** Download de arquivo privado com URL assinada (driver local; no S3 a URL aponta direto ao bucket). */
  @Public()
  @ApiExcludeEndpoint()
  @Get('private/:key')
  async private(
    @Param('key') key: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    if (!(this.storage instanceof LocalStorageAdapter)) throw new NotFoundException();
    const body = await this.storage.readSigned(key, Number(exp), sig);
    if (!body) throw new NotFoundException();
    const file = await this.files.findByKey(key);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.type(file?.mimeType ?? 'application/octet-stream').send(body);
  }
}
