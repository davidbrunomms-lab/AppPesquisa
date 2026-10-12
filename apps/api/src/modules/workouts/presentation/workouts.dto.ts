import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrainingTechnique } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class WorkoutExerciseInput {
  @ApiPropertyOptional({ description: 'Informe para manter o item existente ao editar' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty() @IsUUID() exerciseId: string;
  @ApiProperty({ example: 4 }) @IsInt() @Min(1) @Max(20) sets: number;
  @ApiProperty({ example: '8-12' }) @IsString() @Length(1, 30) reps: string;
  @ApiPropertyOptional({ example: 60 }) @IsOptional() @IsNumber() @Min(0) @Max(1000) suggestedLoadKg?: number;
  @ApiPropertyOptional({ example: 60 }) @IsOptional() @IsInt() @Min(0) @Max(900) restSeconds?: number;
  @ApiPropertyOptional({ enum: TrainingTechnique }) @IsOptional() @IsEnum(TrainingTechnique) technique?: TrainingTechnique;

  @ApiPropertyOptional({ description: 'Mesmo valor agrupa exercícios em bi-set/tri-set/supersérie', example: 'A' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  groupKey?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class SaveWorkoutDto {
  @ApiProperty({ example: 'Treino A — Peito e tríceps' }) @IsString() @Length(1, 120) name: string;
  @ApiPropertyOptional({ example: 'A' }) @IsOptional() @IsString() @MaxLength(20) label?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isTemplate?: boolean;

  @ApiProperty({ type: [WorkoutExerciseInput] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => WorkoutExerciseInput)
  exercises: WorkoutExerciseInput[];
}

export class AssignWorkoutDto {
  @ApiProperty() @IsUUID() studentId: string;

  @ApiPropertyOptional({ type: [Number], example: [1, 3, 5], description: '0 = domingo' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) order?: number;
}

export class ListWorkoutsQuery {
  @ApiPropertyOptional() @IsOptional() @IsUUID() studentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  templates?: boolean;
}
