import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { ReportsService } from '../application/reports.service';

class GenerateReportDto {
  @ApiProperty() @IsUUID() studentId: string;
  @ApiPropertyOptional({ description: 'Qualquer data da semana desejada (padrão: semana passada)' })
  @IsOptional()
  @IsDateString()
  weekStart?: string;
}

@ApiTags('Relatórios')
@ApiBearerAuth()
@Controller('reports/weekly')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @ApiQuery({ name: 'studentId', required: false })
  @Roles('TRAINER', 'STUDENT')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('studentId') studentId?: string) {
    return this.reports.list(user, studentId);
  }

  @Roles('TRAINER')
  @Post()
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateReportDto) {
    return this.reports.generate(user.trainerId!, dto.studentId, dto.weekStart);
  }
}
