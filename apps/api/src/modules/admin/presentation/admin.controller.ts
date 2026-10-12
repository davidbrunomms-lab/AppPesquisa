import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags, PartialType } from '@nestjs/swagger';
import { BillingInterval, SubscriptionStatus, UserRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { PaginationQuery } from '../../../common/utils/pagination';
import { AdminService } from '../application/admin.service';

class UsersQuery extends PaginationQuery {
  @ApiPropertyOptional({ enum: UserRole }) @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}

class PlanDto {
  @ApiProperty({ example: 'PERSONAL_PRO' }) @Matches(/^[A-Z0-9_]{3,40}$/) code: string;
  @ApiProperty() @IsString() @Length(2, 80) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ description: 'Vazio = ilimitado' }) @IsOptional() @IsInt() @Min(1) maxStudents?: number;
  @ApiProperty({ example: 9990 }) @IsInt() @Min(0) priceCents: number;
  @ApiPropertyOptional({ enum: BillingInterval }) @IsOptional() @IsEnum(BillingInterval) interval?: BillingInterval;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

class UpdatePlanDto extends PartialType(PlanDto) {}

class ManualPaymentDto {
  @ApiProperty({ example: 9990 }) @IsInt() @Min(1) amountCents: number;
}

@ApiTags('Administração')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Professores, alunos, usuários ativos, cadastros, treinos, assinaturas e faturamento. */
  @Get('metrics')
  metrics() {
    return this.admin.metrics();
  }

  @Get('users')
  users(@Query() q: UsersQuery) {
    return this.admin.users(q);
  }

  @ApiQuery({ name: 'status', required: false, enum: SubscriptionStatus })
  @Get('subscriptions')
  subscriptions(@Query('status') status?: SubscriptionStatus) {
    return this.admin.subscriptions(status);
  }

  @Post('subscriptions/:id/payments')
  payment(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ManualPaymentDto) {
    return this.admin.registerManualPayment(user.userId, id, dto.amountCents);
  }

  @Get('plans')
  plans() {
    return this.admin.plans();
  }

  @Post('plans')
  createPlan(@Body() dto: PlanDto) {
    return this.admin.createPlan(dto);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.admin.updatePlan(id, dto);
  }
}
