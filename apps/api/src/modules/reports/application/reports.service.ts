import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LinkStatus, NotificationType, Prisma, SessionStatus } from '@prisma/client';
import { addDays, bestSet, buildWeeklyReport, startOfWeek, toDateKey, totalVolume } from '@personalpro/shared';
import { AccessPolicyService } from '../../../common/access/access-policy.service';
import type { AuthUser } from '../../../common/auth/auth-user';
import { num, num0 } from '../../../common/utils/decimal';
import { AiPort } from '../../../infrastructure/ai/ai.port';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../../notifications/application/notifications.service';

const NARRATIVE_PROMPT =
  'Você é assistente de um personal trainer. Com base nos dados, escreva um parágrafo curto (até 4 frases) ' +
  'em português resumindo a semana do aluno e uma recomendação prática para o professor. Não invente números.';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
    private readonly ai: AiPort,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, studentIdParam?: string) {
    const studentId = await this.access.resolveStudentId(user, studentIdParam);
    return this.prisma.weeklyReport.findMany({
      where: { studentId, ...(user.role === 'TRAINER' ? { trainerId: user.trainerId! } : {}) },
      orderBy: { weekStart: 'desc' },
      take: 52,
    });
  }

  /**
   * Resumo semanal: "João treinou 4 vezes nesta semana. Volume total: +12%.
   * Peso: -0,8 kg. Supino: +5 kg. Frequência: 100%."
   */
  async generate(trainerId: string, studentId: string, weekStartIso?: string) {
    await this.access.assertTrainerHasLink(trainerId, studentId);
    const weekStart = startOfWeek(weekStartIso ? new Date(weekStartIso) : addDays(new Date(), -7));
    const weekEnd = addDays(weekStart, 7);
    const prevStart = addDays(weekStart, -7);

    const [student, sessions, prevSessions, assessments] = await Promise.all([
      this.prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { user: true } }),
      this.prisma.workoutSession.findMany({
        where: { studentId, status: SessionStatus.COMPLETED, startedAt: { gte: weekStart, lt: weekEnd } },
        include: { sets: { include: { exercise: { select: { name: true } } } } },
      }),
      this.prisma.workoutSession.findMany({
        where: { studentId, status: SessionStatus.COMPLETED, startedAt: { gte: prevStart, lt: weekStart } },
        include: { sets: true },
      }),
      this.prisma.bodyAssessment.findMany({
        where: { studentId, status: 'COMPLETED', weightKg: { not: null }, assessedAt: { lt: weekEnd } },
        orderBy: { assessedAt: 'asc' },
      }),
    ]);

    const weekSets = sessions.flatMap((s) => s.sets);
    const exerciseIds = [...new Set(weekSets.map((s) => s.exerciseId))];
    const previousSets = await this.prisma.workoutSet.findMany({
      where: { exerciseId: { in: exerciseIds }, session: { studentId, status: SessionStatus.COMPLETED, startedAt: { lt: weekStart } } },
      select: { exerciseId: true, loadKg: true, reps: true },
    });
    const exercises = exerciseIds.map((id) => {
      const current = bestSet(weekSets.filter((s) => s.exerciseId === id).map((s) => ({ loadKg: num0(s.loadKg), reps: s.reps })));
      const previous = bestSet(previousSets.filter((s) => s.exerciseId === id).map((s) => ({ loadKg: num0(s.loadKg), reps: s.reps })));
      return {
        name: weekSets.find((s) => s.exerciseId === id)!.exercise.name,
        previousBestKg: previous?.loadKg ?? null,
        currentBestKg: current?.loadKg ?? 0,
      };
    });
    const before = assessments.filter((a) => a.assessedAt! < weekStart).pop();
    const inWeek = assessments.filter((a) => a.assessedAt! >= weekStart);

    const { data, summary } = buildWeeklyReport({
      studentName: student.user.name,
      weekStart: toDateKey(weekStart),
      sessionsCount: sessions.length,
      plannedPerWeek: student.weeklyFrequency,
      totalVolumeKg: totalVolume(weekSets.map((s) => ({ loadKg: num0(s.loadKg), reps: s.reps }))),
      previousWeekVolumeKg: totalVolume(prevSessions.flatMap((s) => s.sets).map((s) => ({ loadKg: num0(s.loadKg), reps: s.reps }))),
      totalDurationSeconds: sessions.reduce((acc, s) => acc + (s.durationSeconds ?? 0), 0),
      weightStartKg: num((before ?? inWeek[0])?.weightKg),
      weightEndKg: inWeek.length ? num(inWeek[inWeek.length - 1].weightKg) : null,
      exercises,
      personalRecords: weekSets.filter((s) => s.isPersonalRecord).length,
    });
    const narrative = await this.ai.complete(NARRATIVE_PROMPT, `${summary}\n\nDados: ${JSON.stringify(data)}`);
    const payload = { ...data, aiNarrative: narrative } as Prisma.InputJsonValue;

    return this.prisma.weeklyReport.upsert({
      where: { studentId_trainerId_weekStart: { studentId, trainerId, weekStart } },
      create: { studentId, trainerId, weekStart, summary, data: payload },
      update: { summary, data: payload },
    });
  }

  /** Toda segunda-feira às 07:00: relatórios da semana anterior para todos os vínculos ativos. */
  @Cron('0 7 * * 1', { name: 'weekly-reports', timeZone: 'America/Sao_Paulo' })
  async generateAll() {
    const links = await this.prisma.trainerStudent.findMany({ where: { status: LinkStatus.ACTIVE } });
    const perTrainer = new Map<string, number>();
    for (const link of links) {
      try {
        await this.generate(link.trainerId, link.studentId);
        perTrainer.set(link.trainerId, (perTrainer.get(link.trainerId) ?? 0) + 1);
      } catch (error) {
        this.logger.error(`Falha no relatório ${link.id}: ${(error as Error).message}`);
      }
    }
    for (const [trainerId, count] of perTrainer) {
      const trainer = await this.prisma.trainer.findUniqueOrThrow({ where: { id: trainerId } });
      await this.notifications.notify(trainer.userId, {
        type: NotificationType.WEEKLY_REPORT,
        title: 'Relatórios semanais prontos',
        body: `Os resumos da semana de ${count} aluno(s) estão disponíveis.`,
        dedupeKey: `weekly:${toDateKey(startOfWeek(new Date()))}`,
      });
    }
  }
}
