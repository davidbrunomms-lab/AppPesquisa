import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { MuscleGroup } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsEnum, IsIn, IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';

export class CreateExerciseDto {
  @ApiProperty({ example: 'Supino reto com barra' }) @IsString() @Length(2, 120) name: string;
  @ApiProperty({ enum: MuscleGroup }) @IsEnum(MuscleGroup) muscleGroup: MuscleGroup;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) equipment?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_tld: false }) imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_tld: false }) videoUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  instructions?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  commonMistakes?: string[];
}

export class UpdateExerciseDto extends PartialType(CreateExerciseDto) {}

export class ListExercisesQuery {
  @ApiPropertyOptional({ enum: MuscleGroup }) @IsOptional() @IsEnum(MuscleGroup) muscleGroup?: MuscleGroup;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;

  @ApiPropertyOptional({ enum: ['all', 'library', 'custom'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'library', 'custom'])
  scope: 'all' | 'library' | 'custom' = 'all';
}
