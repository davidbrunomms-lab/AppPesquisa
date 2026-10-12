import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LinkStatus, Sex, TrainingGoal, TrainingLevel } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class StudentProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_tld: false }) avatarUrl?: string;
  @ApiPropertyOptional({ example: '1995-04-21' }) @IsOptional() @IsDateString() birthDate?: string;
  @ApiPropertyOptional({ enum: Sex }) @IsOptional() @IsEnum(Sex) sex?: Sex;
  @ApiPropertyOptional({ example: 178 }) @IsOptional() @IsNumber() @Min(50) @Max(250) heightCm?: number;
  @ApiPropertyOptional({ example: 92 }) @IsOptional() @IsNumber() @Min(20) @Max(400) initialWeightKg?: number;
  @ApiPropertyOptional({ example: 84 }) @IsOptional() @IsNumber() @Min(20) @Max(400) currentWeightKg?: number;
  @ApiPropertyOptional({ enum: TrainingGoal }) @IsOptional() @IsEnum(TrainingGoal) goal?: TrainingGoal;
  @ApiPropertyOptional({ enum: TrainingLevel }) @IsOptional() @IsEnum(TrainingLevel) level?: TrainingLevel;
  @ApiPropertyOptional({ minimum: 1, maximum: 14 }) @IsOptional() @IsInt() @Min(1) @Max(14) weeklyFrequency?: number;
  @ApiPropertyOptional({ description: 'Nome da academia' }) @IsOptional() @IsString() @MaxLength(120) gymName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) gymCity?: string;
}

export class CreateStudentDto extends StudentProfileDto {
  @ApiProperty() @IsString() @Length(2, 120) declare name: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiPropertyOptional({ description: 'Início do acompanhamento' }) @IsOptional() @IsDateString() startedAt?: string;
}

export class UpdateLinkDto {
  @ApiPropertyOptional({ enum: [LinkStatus.ACTIVE, LinkStatus.INACTIVE] })
  @IsOptional()
  @IsIn([LinkStatus.ACTIVE, LinkStatus.INACTIVE])
  status?: LinkStatus;

  @ApiPropertyOptional() @IsOptional() @IsDateString() startedAt?: string;
}

export class ListStudentsQuery {
  @ApiPropertyOptional({ description: 'Nome ou e-mail' }) @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ enum: LinkStatus }) @IsOptional() @IsEnum(LinkStatus) status?: LinkStatus;
  @ApiPropertyOptional({ enum: TrainingGoal }) @IsOptional() @IsEnum(TrainingGoal) goal?: TrainingGoal;
  @ApiPropertyOptional({ enum: TrainingLevel }) @IsOptional() @IsEnum(TrainingLevel) level?: TrainingLevel;

  @ApiPropertyOptional({ description: 'Somente alunos sem treinar há N dias ou mais' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  inactiveDays?: number;

  @ApiPropertyOptional({ enum: ['name', 'lastWorkout', 'startedAt'], default: 'name' })
  @IsOptional()
  @Transform(({ value }) => value ?? 'name')
  @IsIn(['name', 'lastWorkout', 'startedAt'])
  sort: 'name' | 'lastWorkout' | 'startedAt' = 'name';
}
