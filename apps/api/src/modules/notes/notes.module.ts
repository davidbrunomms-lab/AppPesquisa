import { Module } from '@nestjs/common';
import { NotesService } from './application/notes.service';
import { NotesController } from './presentation/notes.controller';

@Module({ controllers: [NotesController], providers: [NotesService] })
export class NotesModule {}
