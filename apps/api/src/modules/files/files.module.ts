import { Global, Module } from '@nestjs/common';
import { FilesService } from './application/files.service';
import { FilesController } from './presentation/files.controller';

@Global()
@Module({ controllers: [FilesController], providers: [FilesService], exports: [FilesService] })
export class FilesModule {}
