import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { ScheduleService } from '../application/schedule.service';
import { CancelDto, CreateAppointmentDto, CreateSlotsDto, RangeQuery, RequestAppointmentDto, RescheduleDto } from './schedule.dto';

@ApiTags('Agenda')
@ApiBearerAuth()
@Roles('TRAINER', 'STUDENT')
@Controller('appointments')
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: RangeQuery) {
    return this.schedule.list(user, new Date(q.from), new Date(q.to));
  }

  /** Professor cria horário disponível (sem aluno) ou agendamento confirmado (com aluno). */
  @Roles('TRAINER')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentDto) {
    return this.schedule.create(user.trainerId!, dto);
  }

  @Roles('TRAINER')
  @Post('slots')
  slots(@CurrentUser() user: AuthUser, @Body() dto: CreateSlotsDto) {
    return this.schedule.createSlots(user.trainerId!, dto);
  }

  /** Aluno solicita um horário. */
  @Roles('STUDENT')
  @Post('request')
  request(@CurrentUser() user: AuthUser, @Body() dto: RequestAppointmentDto) {
    return this.schedule.request(user, dto);
  }

  /** Aluno reserva um horário disponível. */
  @Roles('STUDENT')
  @Post(':id/book')
  book(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelDto) {
    return this.schedule.book(user.studentId!, id, dto.reason);
  }

  @Roles('TRAINER')
  @Post(':id/confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.schedule.confirm(user.trainerId!, id);
  }

  @Post(':id/reschedule')
  reschedule(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RescheduleDto) {
    return this.schedule.reschedule(user, id, dto);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelDto) {
    return this.schedule.cancel(user, id, dto.reason);
  }

  @Roles('TRAINER')
  @Post(':id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.schedule.complete(user.trainerId!, id);
  }

  @Roles('TRAINER')
  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.schedule.remove(user.trainerId!, id);
  }
}
