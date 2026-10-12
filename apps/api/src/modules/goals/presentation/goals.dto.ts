import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GoalStatus, GoalType } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class CreateGoalDto {
  @ApiProperty() @IsUUID() studentId: string;
  @ApiProperty({ enum: GoalType }) @IsEnum(GoalType) type: GoalType;
  @ApiProperty({ example: 80 }) @IsNumber() @Min(0) @Max(10000) targetValue: number;
  @ApiPropertyOptional({ description: 'Padrão: valor atual medido' }) @IsOptional() @IsNumber() @Min(0) startValue?: number;
  @ApiPropertyOptional({ description: 'Obrigatório para EXERCISE_LOAD' }) @IsOptional() @IsUUID() exerciseId?: string;
  @ApiPropertyOptional({ description: 'Gerado automaticamente se omitido' }) @IsOptional() @IsString() @Length(2, 120) title?: string;
  @ApiPropertyOptional({ description: 'Obrigatório para CUSTOM' }) @IsOptional() @IsString() @Length(1, 20) unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() deadline?: string;
}

export class UpdateGoalDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) targetValue?: number;
  @ApiPropertyOptional({ description: 'Atualização manual (metas personalizadas)' }) @IsOptional() @IsNumber() @Min(0) currentValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() deadline?: string;
  @ApiPropertyOptional({ enum: GoalStatus }) @IsOptional() @IsEnum(GoalStatus) status?: GoalStatus;
}
