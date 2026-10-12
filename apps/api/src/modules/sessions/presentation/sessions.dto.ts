import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PaginationQuery } from '../../../common/utils/pagination';

export class StartSessionDto {
  @ApiProperty() @IsUUID() workoutId: string;
}

export class LogSetDto {
  @ApiProperty() @IsUUID() exerciseId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() workoutExerciseId?: string;
  @ApiProperty({ example: 1 }) @IsInt() @Min(1) @Max(50) setNumber: number;
  @ApiProperty({ example: 60 }) @IsNumber() @Min(0) @Max(1000) loadKg: number;
  @ApiProperty({ example: 10 }) @IsInt() @Min(0) @Max(500) reps: number;
  @ApiPropertyOptional({ description: 'Percepção de esforço (1–10)' }) @IsOptional() @IsInt() @Min(1) @Max(10) rpe?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class FinishSessionDto {
  @ApiPropertyOptional({ description: 'Esforço geral do treino (1–10)' }) @IsOptional() @IsInt() @Min(1) @Max(10) perceivedEffort?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class SessionHistoryQuery extends PaginationQuery {
  @ApiPropertyOptional() @IsOptional() @IsUUID() studentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}

export class StatsQuery {
  @ApiPropertyOptional() @IsOptional() @IsUUID() studentId?: string;
  @ApiPropertyOptional({ default: 12 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(52) weeks = 12;
}
