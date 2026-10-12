import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { DashboardService } from '../application/dashboard.service';

@ApiTags('Dashboards')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Roles('TRAINER')
  @Get('trainer')
  trainer(@CurrentUser() user: AuthUser) {
    return this.dashboard.trainer(user.trainerId!);
  }

  @Roles('STUDENT')
  @Get('student')
  student(@CurrentUser() user: AuthUser) {
    return this.dashboard.student(user.studentId!);
  }
}
