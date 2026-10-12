import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { DevicePlatform } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';
import type { Request } from 'express';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser } from '../../../common/auth/decorators';
import { AccountService } from '../application/account.service';

class UpdateAccountDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_tld: false }) avatarUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() marketingOptIn?: boolean;
}

class DeviceDto {
  @ApiProperty({ description: 'Token FCM do dispositivo' }) @IsString() @MaxLength(4096) token: string;
  @ApiProperty({ enum: DevicePlatform }) @IsEnum(DevicePlatform) platform: DevicePlatform;
}

class DeleteAccountDto {
  @ApiPropertyOptional({ description: 'Senha atual (obrigatória se a conta tiver senha)' })
  @IsOptional()
  @IsString()
  password?: string;
}

@ApiTags('Conta e privacidade (LGPD)')
@ApiBearerAuth()
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateAccountDto) {
    return this.account.update(user.userId, dto);
  }

  /** Exportação de todos os dados pessoais (portabilidade). */
  @Get('export')
  export(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.account.export(user.userId, req.ip);
  }

  /** Exclusão definitiva da conta e dos dados pessoais. */
  @Delete()
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Body() dto: DeleteAccountDto, @Req() req: Request) {
    return this.account.delete(user.userId, dto.password, req.ip);
  }

  /** Registra o token de push (FCM) do dispositivo. */
  @Post('devices')
  device(@CurrentUser() user: AuthUser, @Body() dto: DeviceDto) {
    return this.account.registerDevice(user.userId, dto.token, dto.platform);
  }

  @Delete('devices/:token')
  @HttpCode(204)
  removeDevice(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.account.removeDevice(user.userId, token);
  }
}
