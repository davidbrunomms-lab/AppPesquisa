import { Module } from '@nestjs/common';
import { AdminService } from './application/admin.service';
import { AdminController } from './presentation/admin.controller';

@Module({ controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
