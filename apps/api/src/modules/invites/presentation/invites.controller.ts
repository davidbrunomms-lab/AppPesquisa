import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { InviteChannel } from '@prisma/client';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import type { Response } from 'express';
import { toBuffer } from 'qrcode';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Public, Roles } from '../../../common/auth/decorators';
import { InvitesService } from '../application/invites.service';

class CreateInviteDto {
  @ApiProperty({ enum: InviteChannel })
  @IsEnum(InviteChannel)
  channel: InviteChannel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '5511999999999' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ default: 7 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  expiresInDays?: number;
}

class AcceptInviteDto {
  @ApiProperty({ example: 'K7M2QXAB' })
  @IsString()
  @Length(4, 16)
  code: string;
}

@ApiTags('Convites')
@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @ApiBearerAuth()
  @Roles('TRAINER')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInviteDto) {
    return this.invites.create(user.trainerId!, dto);
  }

  @ApiBearerAuth()
  @Roles('TRAINER')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.invites.list(user.trainerId!);
  }

  @ApiBearerAuth()
  @Roles('TRAINER')
  @Delete(':id')
  @HttpCode(204)
  revoke(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.invites.revoke(user.trainerId!, id);
  }

  /** Aluno informa o código recebido do professor. */
  @ApiBearerAuth()
  @Roles('STUDENT')
  @Post('accept')
  accept(@CurrentUser() user: AuthUser, @Body() dto: AcceptInviteDto) {
    return this.invites.accept(user.studentId!, dto.code);
  }

  @Public()
  @Get(':code/preview')
  preview(@Param('code') code: string) {
    return this.invites.preview(code);
  }

  /** QR Code (PNG) apontando para o deep link do convite. */
  @Public()
  @Get(':code/qrcode.png')
  async qrcode(@Param('code') code: string, @Res() res: Response) {
    const { deepLink, webUrl } = this.invites.links(code.toUpperCase());
    const png = await toBuffer(`${webUrl}?app=${encodeURIComponent(deepLink)}`, { width: 512, margin: 2 });
    res.type('png').send(png);
  }
}
