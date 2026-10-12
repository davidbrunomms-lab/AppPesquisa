import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssessmentStatus, PhotoAngle } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';

const cm = () => (target: object, key: string) => {
  ApiPropertyOptional({ description: 'cm' })(target, key);
  IsOptional()(target, key);
  IsNumber()(target, key);
  Min(1)(target, key);
  Max(300)(target, key);
};

export class MeasurementsDto {
  @cm() neck?: number;
  @cm() shoulders?: number;
  @cm() chest?: number;
  @cm() rightArm?: number;
  @cm() leftArm?: number;
  @cm() waist?: number;
  @cm() abdomen?: number;
  @cm() hip?: number;
  @cm() rightThigh?: number;
  @cm() leftThigh?: number;
  @cm() rightCalf?: number;
  @cm() leftCalf?: number;
}

export class AssessmentDataDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() assessedAt?: string;
  @ApiPropertyOptional({ example: 84 }) @IsOptional() @IsNumber() @Min(20) @Max(400) weightKg?: number;
  @ApiPropertyOptional({ example: 178 }) @IsOptional() @IsNumber() @Min(50) @Max(250) heightCm?: number;
  @ApiPropertyOptional({ example: 18.5 }) @IsOptional() @IsNumber() @Min(1) @Max(70) bodyFatPct?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(200) muscleMassKg?: number;
  @ApiPropertyOptional({ description: 'Calculada a partir de peso e % de gordura se omitida' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(300)
  leanMassKg?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(60) visceralFat?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;

  @ApiPropertyOptional({ type: MeasurementsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MeasurementsDto)
  measurements?: MeasurementsDto;
}

export class CreateAssessmentDto extends AssessmentDataDto {
  @ApiPropertyOptional({ description: 'Obrigatório para professores' }) @IsOptional() @IsUUID() studentId?: string;
}

export class ScheduleAssessmentDto {
  @ApiProperty() @IsUUID() studentId: string;
  @ApiProperty() @IsDateString() scheduledFor: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class UpdateAssessmentDto extends AssessmentDataDto {
  @ApiPropertyOptional({ enum: AssessmentStatus }) @IsOptional() @IsEnum(AssessmentStatus) status?: AssessmentStatus;
  @ApiPropertyOptional() @IsOptional() @IsDateString() scheduledFor?: string;
}

export class PhotoQuery {
  @ApiProperty({ enum: PhotoAngle }) @IsEnum(PhotoAngle) angle: PhotoAngle;
}

export class CompareQuery {
  @ApiProperty({ description: 'Avaliação "antes"' }) @IsUUID() before: string;
  @ApiProperty({ description: 'Avaliação "depois"' }) @IsUUID() after: string;
}
