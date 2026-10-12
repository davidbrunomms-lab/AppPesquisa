import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppointmentStatus, LinkStatus, NotificationType, SessionStatus } from '@prisma/client';
import { daysSinceLastWorkout, toDateKey } from '@personalpro/shared';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../../notifications/application/notifications.service';

/** Dias sem treinar que disparam lembrete ao aluno. */
const INACTIVITY_REMINDER_DAYS = [3, 7, 14, 30];

/** Notificações automáticas agendadas. */
@Injectable()
export class NotificationJobsService {
  private readonly logger = new Logger(NotificationJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** "Seu treino começa em 1 hora." — a cada 5 minutos, para agendamentos confirmados. */
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'appointment-reminders' })
  async appointmentReminders(now = new Date()) {
    const upcoming = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.CONFIRMED,
        reminderSentAt: null,
        studentId: { not: null },
        startsAt: { gt: now, lte: new Date(now.getTime() + 65 * 60_000) },
      },
      include: { student: true },
    });
    for (const a of upcoming) {
      await this.notifications.notify(a.student!.userId, {
        type: NotificationType.WORKOUT_REMINDER,
        title: 'Lembrete de treino',
        body: 'Seu treino começa em 1 hora.',
        data: { appointmentId: a.id },
        dedupeKey: `reminder:${a.id}:${a.startsAt.toISOString()}`,
      });
      await this.prisma.appointment.update({ where: { id: a.id }, data: { reminderSentAt: new Date() } });
    }
    return upcoming.length;
  }

  /** "Você está há 3 dias sem treinar." — diariamente às 10:00. */
  @Cron('0 10 * * *', { name: 'inactivity-reminders', timeZone: 'America/Sao_Paulo' })
  async inactivityReminders(now = new Date()) {
    const students = await this.prisma.student.findMany({
      where: { trainers: { some: { status: LinkStatus.ACTIVE } }, workouts: { some: { active: true } }, user: { deletedAt: null } },
      select: { id: true, userId: true },
    });
    const last = await this.prisma.workoutSession.groupBy({
      by: ['studentId'],
      where: { studentId: { in: students.map((s) => s.id) }, status: SessionStatus.COMPLETED },
      _max: { startedAt: true },
    });
    let sent = 0;
    for (const s of students) {
      const lastAt = last.find((l) => l.studentId === s.id)?._max.startedAt;
      const days = daysSinceLastWorkout(lastAt ?? null, now);
      if (days === null || !INACTIVITY_REMINDER_DAYS.includes(days)) continue;
      const result = await this.notifications.notify(s.userId, {
        type: NotificationType.INACTIVITY,
        title: 'Bora treinar? 💪',
        body: `Você está há ${days} dias sem treinar.`,
        dedupeKey: `inactivity:${toDateKey(lastAt!)}:${days}`,
      });
      if (result) sent += 1;
    }
    this.logger.log(`Lembretes de inatividade enviados: ${sent}`);
    return sent;
  }
}
