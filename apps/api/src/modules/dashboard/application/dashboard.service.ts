import { Injectable } from '@nestjs/common';
import { AiSuggestionStatus, AppointmentStatus, AssessmentStatus, GoalStatus, LinkStatus, SessionStatus } from '@prisma/client';
import {
  addDays,
  attendanceRate,
  daysSinceLastWorkout,
  endOfDay,
  evolution,
  goalProgress,
  INACTIVITY_THRESHOLD_DAYS,
  isGoalNear,
  round,
  startOfDay,
  startOfMonth,
  startOfWeek,
  trainingStats,
} from '@personalpro/shared';
import { num, num0 } from '../../../common/utils/decimal';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { WorkoutsService } from '../../workouts/application/workouts.service';

/** Considera "avaliação pendente" quem não é avaliado há mais que isso. */
const ASSESSMENT_INTERVAL_DAYS = 90;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workouts: WorkoutsService,
  ) {}

  async trainer(trainerId: string) {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const fourWeeksAgo = addDays(startOfWeek(now), -21);

    const links = await this.prisma.trainerStudent.findMany({
      where: { trainerId },
      include: { student: { include: { user: { select: { name: true, avatarUrl: true } } } } },
    });
    const active = links.filter((l) => l.status === LinkStatus.ACTIVE);
    const activeIds = active.map((l) => l.studentId);

    const [lastSessions, recentSessions, todaySessions, scheduledAssessments, lastAssessments, agenda, goals, pendingAi, unread, sub] =
      await Promise.all([
        this.prisma.workoutSession.groupBy({
          by: ['studentId'],
          where: { studentId: { in: activeIds }, status: SessionStatus.COMPLETED },
          _max: { startedAt: true },
        }),
        this.prisma.workoutSession.findMany({
          where: { studentId: { in: activeIds }, status: SessionStatus.COMPLETED, startedAt: { gte: fourWeeksAgo } },
          select: { studentId: true, startedAt: true },
        }),
        this.prisma.workoutSession.findMany({
          where: { studentId: { in: activeIds }, status: SessionStatus.COMPLETED, startedAt: { gte: todayStart, lte: todayEnd } },
          include: { workout: { select: { name: true } }, student: { include: { user: { select: { name: true, avatarUrl: true } } } } },
          orderBy: { startedAt: 'desc' },
        }),
        this.prisma.bodyAssessment.findMany({
          where: { trainerId, status: AssessmentStatus.SCHEDULED },
          include: { student: { include: { user: { select: { name: true, avatarUrl: true } } } } },
          orderBy: { scheduledFor: 'asc' },
        }),
        this.prisma.bodyAssessment.groupBy({
          by: ['studentId'],
          where: { studentId: { in: activeIds }, status: AssessmentStatus.COMPLETED },
          _max: { assessedAt: true },
        }),
        this.prisma.appointment.findMany({
          where: { trainerId, startsAt: { gte: todayStart, lte: todayEnd }, status: { not: AppointmentStatus.CANCELED } },
          include: { student: { include: { user: { select: { name: true, avatarUrl: true } } } } },
          orderBy: { startsAt: 'asc' },
        }),
        this.prisma.studentGoal.findMany({
          where: { studentId: { in: activeIds }, status: GoalStatus.ACTIVE },
          include: { student: { include: { user: { select: { name: true, avatarUrl: true } } } } },
        }),
        this.prisma.aiSuggestion.count({ where: { trainerId, status: AiSuggestionStatus.PENDING } }),
        this.prisma.message.count({
          where: { conversation: { trainerId }, readAt: null, sender: { trainer: null } },
        }),
        this.prisma.subscription.findUnique({ where: { trainerId }, include: { plan: true } }),
      ]);

    const studentCard = (l: (typeof links)[number]) => ({
      id: l.studentId,
      name: l.student.user.name,
      avatarUrl: l.student.user.avatarUrl,
    });

    const inactive = active
      .map((l) => {
        const last = lastSessions.find((s) => s.studentId === l.studentId)?._max.startedAt ?? null;
        return { ...studentCard(l), lastWorkoutAt: last, daysWithoutTraining: daysSinceLastWorkout(last, now) };
      })
      .filter((s) => s.daysWithoutTraining === null || s.daysWithoutTraining >= INACTIVITY_THRESHOLD_DAYS)
      .sort((a, b) => (b.daysWithoutTraining ?? 999) - (a.daysWithoutTraining ?? 999));

    const plannedPerWeek = active.reduce((acc, l) => acc + l.student.weeklyFrequency, 0);

    const weightDeltas = active
      .map((l) => {
        const i = num(l.student.initialWeightKg);
        const c = num(l.student.currentWeightKg);
        return i !== null && c !== null ? c - i : null;
      })
      .filter((d): d is number => d !== null);

    const needsAssessment = active.filter((l) => {
      const last = lastAssessments.find((a) => a.studentId === l.studentId)?._max.assessedAt;
      return !last || last < addDays(now, -ASSESSMENT_INTERVAL_DAYS);
    });

    const goalsNear = goals
      .map((g) => {
        const values = { startValue: num0(g.startValue), currentValue: num0(g.currentValue), targetValue: num0(g.targetValue) };
        return { id: g.id, title: g.title, progressPct: goalProgress(values), near: isGoalNear(values), student: { id: g.studentId, name: g.student.user.name, avatarUrl: g.student.user.avatarUrl } };
      })
      .filter((g) => g.near)
      .sort((a, b) => b.progressPct - a.progressPct)
      .map(({ near: _near, ...g }) => g);

    return {
      activeStudents: active.length,
      inactiveLinks: links.filter((l) => l.status === LinkStatus.INACTIVE).length,
      newStudents: links.filter((l) => l.startedAt >= addDays(now, -30)).map(studentCard),
      studentsWithoutTraining: inactive,
      workoutsToday: {
        count: todaySessions.length,
        items: todaySessions.map((s) => ({
          sessionId: s.id,
          student: { id: s.studentId, name: s.student.user.name, avatarUrl: s.student.user.avatarUrl },
          workout: s.workout?.name ?? null,
          startedAt: s.startedAt,
          durationSeconds: s.durationSeconds,
        })),
      },
      pendingAssessments: {
        overdueScheduled: scheduledAssessments
          .filter((a) => a.scheduledFor && a.scheduledFor < now)
          .map((a) => ({ id: a.id, scheduledFor: a.scheduledFor, student: { id: a.studentId, name: a.student.user.name } })),
        studentsDue: needsAssessment.map(studentCard),
      },
      upcomingAssessments: scheduledAssessments
        .filter((a) => a.scheduledFor && a.scheduledFor >= now)
        .slice(0, 10)
        .map((a) => ({ id: a.id, scheduledFor: a.scheduledFor, student: { id: a.studentId, name: a.student.user.name, avatarUrl: a.student.user.avatarUrl } })),
      agendaToday: agenda.map((a) => ({
        id: a.id,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        status: a.status,
        student: a.student ? { id: a.student.id, name: a.student.user.name, avatarUrl: a.student.user.avatarUrl } : null,
      })),
      overallEvolution: {
        averageWeightDeltaKg: weightDeltas.length ? round(weightDeltas.reduce((a, b) => a + b, 0) / weightDeltas.length, 1) : null,
        studentsWithWeightData: weightDeltas.length,
        workoutsThisMonth: await this.prisma.workoutSession.count({
          where: { studentId: { in: activeIds }, status: SessionStatus.COMPLETED, startedAt: { gte: startOfMonth(now) } },
        }),
      },
      attendanceRate: attendanceRate(recentSessions.length, plannedPerWeek, 4),
      goalsNearCompletion: goalsNear,
      pendingAiSuggestions: pendingAi,
      unreadMessages: unread,
      subscription: sub
        ? { plan: sub.plan.name, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd, maxStudents: sub.plan.maxStudents, usedSeats: links.filter((l) => l.status !== LinkStatus.INACTIVE).length }
        : null,
    };
  }

  async student(studentId: string) {
    const now = new Date();
    const [student, todayWorkout, nextAppointment, sessions, goals, link] = await Promise.all([
      this.prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { user: { select: { name: true, avatarUrl: true } } } }),
      this.workouts.today(studentId, now),
      this.prisma.appointment.findFirst({
        where: { studentId, startsAt: { gte: now }, status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.REQUESTED] } },
        include: { trainer: { include: { user: { select: { name: true } } } } },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.workoutSession.findMany({
        where: { studentId, status: SessionStatus.COMPLETED },
        select: { id: true, startedAt: true, durationSeconds: true, totalVolumeKg: true, workout: { select: { name: true } } },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.studentGoal.findMany({
        where: { studentId, status: GoalStatus.ACTIVE },
        include: { exercise: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.trainerStudent.findFirst({
        where: { studentId, status: LinkStatus.ACTIVE },
        include: { trainer: { include: { user: { select: { name: true, avatarUrl: true } } } } },
        orderBy: { startedAt: 'desc' },
      }),
    ]);
    const unreadNotifications = await this.prisma.notification.count({ where: { userId: student.userId, readAt: null } });

    const stats = trainingStats(sessions, now);
    const initial = num(student.initialWeightKg);
    const current = num(student.currentWeightKg);
    const mainGoal = goals[0]
      ? (() => {
          const values = { startValue: num0(goals[0].startValue), currentValue: num0(goals[0].currentValue), targetValue: num0(goals[0].targetValue) };
          return { id: goals[0].id, title: goals[0].title, unit: goals[0].unit, ...values, progressPct: goalProgress(values) };
        })()
      : null;

    return {
      greetingName: student.user.name.split(' ')[0],
      todayWorkout: todayWorkout
        ? {
            id: todayWorkout.id,
            name: todayWorkout.name,
            label: todayWorkout.label,
            exercisesCount: todayWorkout.exercises.length,
            scheduledForToday: todayWorkout.scheduledForToday,
            completedToday: todayWorkout.completedToday,
          }
        : null,
      nextAppointment: nextAppointment
        ? { id: nextAppointment.id, startsAt: nextAppointment.startsAt, status: nextAppointment.status, trainerName: nextAppointment.trainer.user.name }
        : null,
      weekProgress: {
        done: stats.weekCount,
        planned: student.weeklyFrequency,
        pct: attendanceRate(stats.weekCount, student.weeklyFrequency),
      },
      weight: { currentKg: current, initialKg: initial, evolution: initial !== null && current !== null ? evolution(initial, current) : null },
      mainGoal,
      goalsCount: goals.length,
      totalWorkouts: sessions.length,
      lastWorkout: sessions[0] ? { id: sessions[0].id, name: sessions[0].workout?.name ?? null, startedAt: sessions[0].startedAt } : null,
      stats,
      trainer: link
        ? { id: link.trainerId, name: link.trainer.user.name, avatarUrl: link.trainer.user.avatarUrl, conversationId: link.id }
        : null,
      unreadNotifications,
    };
  }
}
