import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class GymDto {
  @ApiProperty() @IsString() @MaxLength(120) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2) state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) address?: string;
}

export class AvailabilityDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: '0 = domingo' })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @ApiProperty({ example: '08:00' }) @Matches(TIME) startTime: string;
  @ApiProperty({ example: '12:00' }) @Matches(TIME) endTime: string;
}

export class UpdateTrainerDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_tld: false }) avatarUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) cref?: string;

  @ApiPropertyOptional({ type: [String], example: ['Hipertrofia', 'Emagrecimento'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  specialties?: string[];

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) bio?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(70) experienceYears?: number;

  @ApiPropertyOptional({ example: { instagram: '@prof', youtube: 'https://youtube.com/@prof' } })
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;

  @ApiPropertyOptional({ type: [GymDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GymDto)
  gyms?: GymDto[];

  @ApiPropertyOptional({ type: [AvailabilityDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityDto)
  availability?: AvailabilityDto[];
}

export class ReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) rating: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}
