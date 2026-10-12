import { Injectable } from '@nestjs/common';
import { Appointment, AppointmentStatus, LinkStatus, NotificationType, Prisma } from '@prisma/client';
import { AccessPolicyService } from '../../../common/access/access-policy.service';
import type { AuthUser } from '../../../common/auth/auth-user';
import { ConflictError, DomainError, ForbiddenError, NotFoundError } from '../../../common/errors/domain-errors';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { CreateAppointmentDto, CreateSlotsDto, RequestAppointmentDto, RescheduleDto } from '../presentation/schedule.dto';

const include = {
  student: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
  trainer: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
} satisfies Prisma.AppointmentInclude;
type AppointmentFull = Prisma.AppointmentGetPayload<{ include: typeof include }>;

const BUSY: AppointmentStatus[] = [AppointmentStatus.REQUESTED, AppointmentStatus.CONFIRMED];
const MAX_SLOTS = 48;

const fmt = (d: Date) =>
  d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
    private readonly notifications: NotificationsService,
  ) {}

  serialize(a: AppointmentFull) {
    return {
      id: a.id,
      status: a.status,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      location: a.location,
      notes: a.notes,
      cancelReason: a.cancelReason,
      trainer: { id: a.trainerId, name: a.trainer.user.name, avatarUrl: a.trainer.user.avatarUrl },
      student: a.student ? { id: a.student.id, name: a.student.user.name, avatarUrl: a.student.user.avatarUrl } : null,
    };
  }

  /** Professor: agenda completa. Aluno: seus horários + horários disponíveis dos seus professores. */
  async list(user: AuthUser, from: Date, to: Date) {
    const range = { startsAt: { gte: from, lt: to } };
    let where: Prisma.AppointmentWhereInput;
    if (user.role === 'TRAINER') {
      where = { trainerId: user.trainerId!, ...range };
    } else {
      const links = await this.prisma.trainerStudent.findMany({
        where: { studentId: user.studentId!, status: LinkStatus.ACTIVE },
        select: { trainerId: true },
      });
      where = {
        ...range,
        OR: [
          { studentId: user.studentId! },
          { trainerId: { in: links.map((l) => l.trainerId) }, status: AppointmentStatus.AVAILABLE, startsAt: { gte: new Date(Math.max(Date.now(), from.getTime())), lt: to } },
        ],
      };
    }
    const items = await this.prisma.appointment.findMany({ where, include, orderBy: { startsAt: 'asc' } });
    return items.map((a) => this.serialize(a));
  }

  async create(trainerId: string, dto: CreateAppointmentDto) {
    const { startsAt, endsAt } = this.range(dto.startsAt, dto.endsAt);
    if (dto.studentId) await this.access.assertTrainerCanAccessStudent(trainerId, dto.studentId);
    await this.assertFree(trainerId, startsAt, endsAt, null, !dto.studentId);
    const appointment = await this.prisma.appointment.create({
      data: {
        trainerId,
        studentId: dto.studentId,
        startsAt,
        endsAt,
        location: dto.location,
        notes: dto.notes,
        status: dto.studentId ? AppointmentStatus.CONFIRMED : AppointmentStatus.AVAILABLE,
      },
      include,
    });
    if (appointment.student) {
      await this.notify(appointment.student.user.id, 'Treino agendado', `Seu professor agendou um treino para ${fmt(startsAt)}.`, appointment.id);
    }
    return this.serialize(appointment);
  }

  /** Gera horários disponíveis em sequência (ex.: 08:00–12:00 de 60 em 60 min), pulando conflitos. */
  async createSlots(trainerId: string, dto: CreateSlotsDto) {
    const { startsAt, endsAt } = this.range(dto.startsAt, dto.endsAt);
    const created: AppointmentFull[] = [];
    for (let t = startsAt.getTime(); t + dto.durationMinutes * 60_000 <= endsAt.getTime(); t += dto.durationMinutes * 60_000) {
      if (created.length >= MAX_SLOTS) break;
      const s = new Date(t);
      const e = new Date(t + dto.durationMinutes * 60_000);
      if (await this.hasConflict(trainerId, s, e, null, true)) continue;
      created.push(
        await this.prisma.appointment.create({
          data: { trainerId, startsAt: s, endsAt: e, location: dto.location, status: AppointmentStatus.AVAILABLE },
          include,
        }),
      );
    }
    return created.map((a) => this.serialize(a));
  }

  /** Aluno reserva um horário disponível → aguarda confirmação do professor. */
  async book(studentId: string, id: string, notes?: string) {
    const slot = await this.prisma.appointment.findUnique({ where: { id } });
    if (!slot || slot.status !== AppointmentStatus.AVAILABLE) throw new NotFoundError('Horário disponível');
    await this.access.assertTrainerCanAccessStudent(slot.trainerId, studentId);
    if (slot.startsAt < new Date()) throw new DomainError('Este horário já passou', 'PAST_SLOT');
    const student = await this.prisma.student.findUniqueOrThrow({ where: { id: studentId } });
    // updateMany condicional evita que dois alunos reservem o mesmo horário
    const { count } = await this.prisma.appointment.updateMany({
      where: { id, status: AppointmentStatus.AVAILABLE },
      data: { status: AppointmentStatus.REQUESTED, studentId, requestedById: student.userId, notes },
    });
    if (!count) throw new ConflictError('Horário acabou de ser reservado por outro aluno');
    const appointment = await this.prisma.appointment.findUniqueOrThrow({ where: { id }, include });
    await this.notify(appointment.trainer.user.id, 'Solicitação de horário', `${appointment.student!.user.name} solicitou o horário de ${fmt(slot.startsAt)}.`, id);
    return this.serialize(appointment);
  }

  /** Aluno solicita um horário livre (fora dos horários publicados). */
  async request(user: AuthUser, dto: RequestAppointmentDto) {
    const studentId = this.access.requireStudent(user);
    const trainerId = dto.trainerId ?? (await this.access.primaryLinkForStudent(studentId))?.trainerId;
    if (!trainerId) throw new DomainError('Você ainda não está vinculado a um professor', 'NO_TRAINER');
    await this.access.assertTrainerCanAccessStudent(trainerId, studentId);
    const { startsAt, endsAt } = this.range(dto.startsAt, dto.endsAt);
    if (startsAt < new Date()) throw new DomainError('Escolha um horário futuro', 'PAST_SLOT');
    await this.assertFree(trainerId, startsAt, endsAt, null, false);
    const appointment = await this.prisma.appointment.create({
      data: { trainerId, studentId, requestedById: user.userId, startsAt, endsAt, notes: dto.notes, status: AppointmentStatus.REQUESTED },
      include,
    });
    await this.notify(appointment.trainer.user.id, 'Solicitação de horário', `${appointment.student!.user.name} solicitou um treino em ${fmt(startsAt)}.`, appointment.id);
    return this.serialize(appointment);
  }

  async confirm(trainerId: string, id: string) {
    const a = await this.getForTrainer(trainerId, id);
    if (a.status !== AppointmentStatus.REQUESTED) throw new ConflictError('Somente solicitações podem ser confirmadas');
    await this.assertFree(trainerId, a.startsAt, a.endsAt, id, false, [AppointmentStatus.CONFIRMED]);
    const updated = await this.prisma.appointment.update({ where: { id }, data: { status: AppointmentStatus.CONFIRMED }, include });
    await this.notify(updated.student!.user.id, 'Horário confirmado', `Seu treino de ${fmt(updated.startsAt)} foi confirmado.`, id);
    return this.serialize(updated);
  }

  async reschedule(user: AuthUser, id: string, dto: RescheduleDto) {
    const a = await this.getForUser(user, id);
    if (a.status === AppointmentStatus.CANCELED || a.status === AppointmentStatus.COMPLETED) {
      throw new ConflictError('Agendamento encerrado');
    }
    const { startsAt, endsAt } = this.range(dto.startsAt, dto.endsAt);
    await this.assertFree(a.trainerId, startsAt, endsAt, id, a.status === AppointmentStatus.AVAILABLE);
    const byStudent = user.role === 'STUDENT';
    const status = byStudent && a.status === AppointmentStatus.CONFIRMED ? AppointmentStatus.REQUESTED : a.status;
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { startsAt, endsAt, status, reminderSentAt: null },
      include,
    });
    if (byStudent) {
      await this.notify(updated.trainer.user.id, 'Pedido de reagendamento', `${updated.student!.user.name} pediu para reagendar para ${fmt(startsAt)}.`, id);
    } else if (updated.student) {
      await this.notify(updated.student.user.id, 'Treino reagendado', `Seu treino foi reagendado para ${fmt(startsAt)}.`, id);
    }
    return this.serialize(updated);
  }

  async cancel(user: AuthUser, id: string, reason?: string) {
    const a = await this.getForUser(user, id);
    if (a.status === AppointmentStatus.CANCELED || a.status === AppointmentStatus.COMPLETED) {
      throw new ConflictError('Agendamento encerrado');
    }
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELED, cancelReason: reason },
      include,
    });
    const reasonText = reason ? ` Motivo: ${reason}` : '';
    if (user.role === 'STUDENT') {
      await this.notify(updated.trainer.user.id, 'Treino cancelado', `${updated.student!.user.name} cancelou o treino de ${fmt(a.startsAt)}.${reasonText}`, id);
    } else if (updated.student) {
      await this.notify(updated.student.user.id, 'Treino cancelado', `Seu treino de ${fmt(a.startsAt)} foi cancelado.${reasonText}`, id);
    }
    return this.serialize(updated);
  }

  async complete(trainerId: string, id: string) {
    const a = await this.getForTrainer(trainerId, id);
    if (a.status !== AppointmentStatus.CONFIRMED) throw new ConflictError('Somente agendamentos confirmados podem ser concluídos');
    return this.serialize(await this.prisma.appointment.update({ where: { id }, data: { status: AppointmentStatus.COMPLETED }, include }));
  }

  async remove(trainerId: string, id: string) {
    const a = await this.getForTrainer(trainerId, id);
    if (a.status !== AppointmentStatus.AVAILABLE) throw new ConflictError('Cancele o agendamento em vez de excluí-lo');
    await this.prisma.appointment.delete({ where: { id } });
  }

  private range(startIso: string, endIso: string) {
    const startsAt = new Date(startIso);
    const endsAt = new Date(endIso);
    if (endsAt <= startsAt) throw new DomainError('O horário final deve ser após o inicial', 'INVALID_TIME_RANGE');
    if (endsAt.getTime() - startsAt.getTime() > 12 * 3600_000) throw new DomainError('Período muito longo', 'INVALID_TIME_RANGE');
    return { startsAt, endsAt };
  }

  private hasConflict(trainerId: string, startsAt: Date, endsAt: Date, excludeId: string | null, includeAvailable: boolean, statuses = BUSY) {
    return this.prisma.appointment.findFirst({
      where: {
        trainerId,
        id: excludeId ? { not: excludeId } : undefined,
        status: { in: includeAvailable ? [...statuses, AppointmentStatus.AVAILABLE] : statuses },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
  }

  private async assertFree(trainerId: string, s: Date, e: Date, excludeId: string | null, includeAvailable: boolean, statuses = BUSY) {
    if (await this.hasConflict(trainerId, s, e, excludeId, includeAvailable, statuses)) {
      throw new ConflictError('Conflito de horário na agenda do professor');
    }
  }

  private async getForTrainer(trainerId: string, id: string): Promise<Appointment> {
    const a = await this.prisma.appointment.findFirst({ where: { id, trainerId } });
    if (!a) throw new NotFoundError('Agendamento');
    return a;
  }

  private async getForUser(user: AuthUser, id: string): Promise<Appointment> {
    if (user.role === 'TRAINER') return this.getForTrainer(user.trainerId!, id);
    if (user.role !== 'STUDENT') throw new ForbiddenError();
    const a = await this.prisma.appointment.findFirst({ where: { id, studentId: user.studentId! } });
    if (!a) throw new NotFoundError('Agendamento');
    return a;
  }

  private notify(userId: string, title: string, body: string, appointmentId: string) {
    return this.notifications.notify(userId, { type: NotificationType.APPOINTMENT, title, body, data: { appointmentId } });
  }
}
