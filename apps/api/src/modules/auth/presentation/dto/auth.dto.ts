import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthProvider } from '@prisma/client';
import { Equals, IsBoolean, IsEmail, IsIn, IsEnum, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Maria Souza' })
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiProperty({ example: 'maria@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SenhaForte123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ enum: ['STUDENT', 'TRAINER'] })
  @IsIn(['STUDENT', 'TRAINER'])
  role: 'STUDENT' | 'TRAINER';

  @ApiPropertyOptional({ example: '+5511999999999' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ description: 'Código do professor (somente alunos)' })
  @IsOptional()
  @IsString()
  @Length(4, 16)
  inviteCode?: string;

  @ApiPropertyOptional({ description: 'CREF (somente professores)' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  cref?: string;

  @ApiProperty({ description: 'Aceite dos termos de uso e da política de privacidade (LGPD)' })
  @IsBoolean()
  @Equals(true, { message: 'É necessário aceitar os termos de uso e a política de privacidade' })
  acceptTerms: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;
}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  password: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class SocialLoginDto {
  @ApiProperty({ enum: AuthProvider })
  @IsEnum(AuthProvider)
  provider: AuthProvider;

  @ApiProperty({ description: 'ID token retornado pelo SDK do Google ou da Apple' })
  @IsString()
  idToken: string;

  @ApiPropertyOptional({ enum: ['STUDENT', 'TRAINER'], description: 'Obrigatório no primeiro acesso' })
  @IsOptional()
  @IsIn(['STUDENT', 'TRAINER'])
  role?: 'STUDENT' | 'TRAINER';

  @ApiPropertyOptional({ description: 'Nome (a Apple só envia no primeiro login)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inviteCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  acceptTerms?: boolean;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

export class ChangePasswordDto {
  @ApiPropertyOptional({ description: 'Obrigatória quando a conta já possui senha' })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
