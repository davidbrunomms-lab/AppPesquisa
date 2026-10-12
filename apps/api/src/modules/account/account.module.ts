import { Module } from '@nestjs/common';
import { AccountService } from './application/account.service';
import { AccountController } from './presentation/account.controller';

@Module({ controllers: [AccountController], providers: [AccountService] })
export class AccountModule {}
