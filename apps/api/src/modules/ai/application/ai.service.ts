import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  AiSuggestionStatus,
  AiSuggestionType,
  LinkStatus,
  NotificationType,
  Prisma,
  SessionStatus,
  SubscriptionStatus,
} from '@prisma/client';
import {
  addDays,
  daysSinceLastWorkout,
  detectLowFrequency,
  detectStagnation,
  ExerciseSessionHistory,
  parseTargetReps,
  suggestLoadProgression,
  SuggestionDraft,
  toDateKey,
} from '@personalpro/shared';
import { AccessPolicyService } from '../../../common/access/access-policy.service';
import { ConflictError, NotFoundError } from '../../../common/errors/domain-errors';
import { num, num0 } from '../../../common/utils/decimal';
import { AiPort } from '../../../infrastructure/ai/ai.port';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../../notifications/application/notifications.service';

const SYSTEM_PROMPT =
  'Você é um assistente de um personal trainer brasileiro. Reescreva a recomendação em português, de forma ' +
  'objetiva, profissional e em no máximo 3 frases. Não invente dados. A decisão final é sempre do professor.';

/**
 * IA para o personal trainer. Princípio: a IA SUGERE, o professor DECIDE.
 * Nenhuma ficha é alterada sem aprovação explícita (approve()).
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
    private readonly ai: AiPort,
    private readonly notifications: NotificationsService,
  ) {}

  list(trainerId: string, status?: AiSuggestionStatus, studentId?: string) {
    return this.prisma.aiSuggestion.findMany({
      where: { trainerId, status, studentId },
      include: { student: { include: { user: { select: { name: true, avatarUrl: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** Analisa um aluno e grava novas sugestões pendentes (sem duplicar as existentes). */
  async analyzeStudent(trainerId: string, studentId: string, opts: { notify?: boolean } = {}) {
    await this.access.assertTrainerCanAccessStudent(trainerId, studentId);
    const drafts = await this.buildDrafts(trainerId, studentId);
    const created = [];
    for (const draft of drafts) {
      if (await this.isDuplicate(trainerId, studentId, draft)) continue;
      const enriched = await this.ai.complete(SYSTEM_PROMPT, `${draft.title}\n${draft.content}`);
      created.push(
        await this.prisma.aiSuggestion.create({
          data: {
            trainerId,
            studentId,
            type: draft.type,
            title: draft.title,
            content: enriched ?? draft.content,
            payload: draft.payload as Prisma.InputJsonValue,
            source: enriched ? this.ai.name : 'rules',
          },
        }),
      );
    }
    if (created.length && opts.notify !== false) {
      const trainer = await this.prisma.trainer.findUniqueOrThrow({ where: { id: trainerId } });
      await this.notifications.notify(trainer.userId, {
        type: NotificationType.AI_SUGGESTION,
        title: 'Novas sugestões da IA',
        body: `${created.length} sugestão(ões) aguardando sua aprovação.`,
        dedupeKey: `ai:${toDateKey(new Date())}:${studentId}`,
      });
    }
    return created;
  }

  async analyzeTrainer(trainerId: string) {
    const links = await this.prisma.trainerStudent.findMany({ where: { trainerId, status: LinkStatus.ACTIVE } });
    let total = 0;
    for (const link of links) total += (await this.analyzeStudent(trainerId, link.studentId, { notify: false })).length;
    if (total) {
      const trainer = await this.prisma.trainer.findUniqueOrThrow({ where: { id: trainerId } });
      await this.notifications.notify(trainer.userId, {
        type: NotificationType.AI_SUGGESTION,
        title: 'Novas sugestões da IA',
        body: `${total} sugestão(ões) para seus alunos aguardando aprovação.`,
        dedupeKey: `ai:${toDateKey(new Date())}`,
      });
    }
    return { students: links.length, suggestions: total };
  }

  /** Aprovação do professor. Somente aqui uma progressão de carga é aplicada à ficha. */
  async approve(trainerId: string, id: string) {
    const suggestion = await this.pending(trainerId, id);
    if (suggestion.type === AiSuggestionType.LOAD_PROGRESSION) {
      const payload = suggestion.payload as { workoutExerciseId?: string; suggestedLoadKg?: number };
      const we = await this.prisma.workoutExercise.findFirst({
        where: { id: payload.workoutExerciseId, workout: { trainerId } },
        include: { exercise: true },
      });
      if (!we || typeof payload.suggestedLoadKg !== 'number') throw new NotFoundError('Exercício da ficha');
      await this.prisma.$transaction([
        this.prisma.workoutExercise.update({ where: { id: we.id }, data: { suggestedLoadKg: payload.suggestedLoadKg } }),
        this.prisma.aiSuggestion.update({ where: { id }, data: { status: AiSuggestionStatus.APPLIED, reviewedAt: new Date() } }),
      ]);
      const student = await this.prisma.student.findUniqueOrThrow({ where: { id: suggestion.studentId } });
      await this.notifications.notify(student.userId, {
        type: NotificationType.WORKOUT_UPDATED,
        title: 'Treino atualizado',
        body: `Seu professor atualizou seu treino: ${we.exercise.name} agora com ${payload.suggestedLoadKg} kg.`,
        data: { workoutId: we.workoutId },
      });
      return this.prisma.aiSuggestion.findUniqueOrThrow({ where: { id } });
    }
    return this.prisma.aiSuggestion.update({ where: { id }, data: { status: AiSuggestionStatus.APPROVED, reviewedAt: new Date() } });
  }

  async reject(trainerId: string, id: string) {
    await this.pending(trainerId, id);
    return this.prisma.aiSuggestion.update({ where: { id }, data: { status: AiSuggestionStatus.REJECTED, reviewedAt: new Date() } });
  }

  /** Execução diária para professores com assinatura válida. */
  @Cron('0 6 * * *', { name: 'ai-daily-analysis', timeZone: 'America/Sao_Paulo' })
  async dailyAnalysis() {
    const trainers = await this.prisma.trainer.findMany({
      where: {
        subscription: {
          OR: [
            { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] } },
            { status: SubscriptionStatus.TRIALING, currentPeriodEnd: { gt: new Date() } },
          ],
        },
      },
      select: { id: true },
    });
    for (const t of trainers) {
      try {
        await this.analyzeTrainer(t.id);
      } catch (error) {
        this.logger.error(`Falha na análise do professor ${t.id}: ${(error as Error).message}`);
      }
    }
  }

  private async buildDrafts(trainerId: string, studentId: string): Promise<SuggestionDraft[]> {
    const drafts: SuggestionDraft[] = [];
    const [student, assignments, sessions] = await Promise.all([
      this.prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { user: true } }),
      this.prisma.studentWorkout.findMany({
        where: { studentId, active: true, workout: { trainerId } },
        include: { workout: { include: { exercises: { include: { exercise: true } } } } },
      }),
      this.prisma.workoutSession.findMany({
        where: { studentId, status: SessionStatus.COMPLETED, startedAt: { gte: addDays(new Date(), -120) } },
        include: { sets: true },
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    for (const assignment of assignments) {
      for (const we of assignment.workout.exercises) {
        const history: ExerciseSessionHistory = {
          workoutExerciseId: we.id,
          exerciseName: we.exercise.name,
          targetReps: parseTargetReps(we.reps),
          currentSuggestedLoadKg: num(we.suggestedLoadKg),
          sessions: sessions
            .map((s) => ({
              date: s.startedAt.toISOString(),
              sets: s.sets
                .filter((set) => set.exerciseId === we.exerciseId)
                .map((set) => ({ loadKg: num0(set.loadKg), reps: set.reps, rpe: set.rpe })),
            }))
            .filter((s) => s.sets.length > 0),
        };
        const progression = suggestLoadProgression(history);
        if (progression && (num(we.suggestedLoadKg) ?? 0) < (progression.payload.suggestedLoadKg as number)) {
          drafts.push(progression);
        }
        const stagnation = detectStagnation(history);
        if (stagnation) drafts.push(stagnation);
      }
    }

    const twoWeeksAgo = addDays(new Date(), -14);
    const lowFrequency = detectLowFrequency({
      studentName: student.user.name,
      sessionsLastTwoWeeks: sessions.filter((s) => s.startedAt >= twoWeeksAgo).length,
      plannedPerWeek: student.weeklyFrequency,
      daysSinceLastWorkout: daysSinceLastWorkout(sessions[0]?.startedAt ?? null),
    });
    // Só faz sentido cobrar frequência de quem já tem treino prescrito
    if (lowFrequency && assignments.length) drafts.push(lowFrequency);
    return drafts;
  }

  /** Evita repetir a mesma sugestão: pendente igual, ou igual decidida há menos de 7 dias. */
  private async isDuplicate(trainerId: string, studentId: string, draft: SuggestionDraft) {
    const workoutExerciseId = draft.payload.workoutExerciseId as string | undefined;
    const existing = await this.prisma.aiSuggestion.findMany({
      where: {
        trainerId,
        studentId,
        type: draft.type,
        OR: [{ status: AiSuggestionStatus.PENDING }, { createdAt: { gte: addDays(new Date(), -7) } }],
      },
    });
    return existing.some((s) => !workoutExerciseId || (s.payload as { workoutExerciseId?: string }).workoutExerciseId === workoutExerciseId);
  }

  private async pending(trainerId: string, id: string) {
    const suggestion = await this.prisma.aiSuggestion.findFirst({ where: { id, trainerId } });
    if (!suggestion) throw new NotFoundError('Sugestão');
    if (suggestion.status !== AiSuggestionStatus.PENDING) throw new ConflictError('Sugestão já revisada');
    return suggestion;
  }
}
