import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class RangeQuery {
  @ApiProperty({ example: '2026-10-12T00:00:00.000Z' }) @IsDateString() from: string;
  @ApiProperty({ example: '2026-10-19T00:00:00.000Z' }) @IsDateString() to: string;
}

export class CreateAppointmentDto {
  @ApiPropertyOptional({ description: 'Sem aluno = horário disponível' }) @IsOptional() @IsUUID() studentId?: string;
  @ApiProperty() @IsDateString() startsAt: string;
  @ApiProperty() @IsDateString() endsAt: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) location?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreateSlotsDto {
  @ApiProperty({ description: 'Início do período (ex.: 08:00 do dia, em ISO)' }) @IsDateString() startsAt: string;
  @ApiProperty({ description: 'Fim do período' }) @IsDateString() endsAt: string;
  @ApiProperty({ example: 60 }) @IsInt() @Min(15) @Max(240) durationMinutes: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) location?: string;
}

export class RequestAppointmentDto {
  @ApiPropertyOptional({ description: 'Padrão: professor principal' }) @IsOptional() @IsUUID() trainerId?: string;
  @ApiProperty() @IsDateString() startsAt: string;
  @ApiProperty() @IsDateString() endsAt: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class RescheduleDto {
  @ApiProperty() @IsDateString() startsAt: string;
  @ApiProperty() @IsDateString() endsAt: string;
}

export class CancelDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) reason?: string;
}
