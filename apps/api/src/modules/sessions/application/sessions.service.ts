import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma, SessionStatus } from '@prisma/client';
import {
  bestSet,
  estimateCalories,
  isPersonalRecord,
  isWorkoutMilestone,
  totalVolume,
} from '@personalpro/shared';
import { AccessPolicyService } from '../../../common/access/access-policy.service';
import type { AuthUser } from '../../../common/auth/auth-user';
import { ConflictError, NotFoundError } from '../../../common/errors/domain-errors';
import { num, num0 } from '../../../common/utils/decimal';
import { paginate } from '../../../common/utils/pagination';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { GoalsService } from '../../goals/application/goals.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { workoutInclude } from '../../workouts/application/workouts.service';
import { FinishSessionDto, LogSetDto, SessionHistoryQuery } from '../presentation/sessions.dto';

/** Sessões abertas há mais tempo que isso são abandonadas ao iniciar outra. */
const STALE_SESSION_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
    private readonly notifications: NotificationsService,
    private readonly goals: GoalsService,
  ) {}

  /** INICIAR TREINO: cria (ou retoma) a sessão e devolve a tela de execução. */
  async start(studentId: string, workoutId: string) {
    const assignment = await this.prisma.studentWorkout.findFirst({ where: { studentId, workoutId, active: true } });
    if (!assignment) throw new NotFoundError('Treino');

    const open = await this.prisma.workoutSession.findFirst({
      where: { studentId, status: SessionStatus.IN_PROGRESS },
      orderBy: { startedAt: 'desc' },
    });
    if (open) {
      const stale = Date.now() - open.startedAt.getTime() > STALE_SESSION_MS;
      if (!stale && open.workoutId === workoutId) return this.executionView(open.id);
      await this.prisma.workoutSession.update({ where: { id: open.id }, data: { status: SessionStatus.ABANDONED } });
    }
    const session = await this.prisma.workoutSession.create({
      data: { studentId, workoutId, studentWorkoutId: assignment.id },
    });
    return this.executionView(session.id);
  }

  async get(user: AuthUser, id: string) {
    const session = await this.prisma.workoutSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundError('Sessão');
    await this.access.resolveStudentId(user, session.studentId);
    return this.executionView(id);
  }

  /**
   * Para cada exercício: prescrição, mídia, carga recomendada, séries da última
   * execução ("carga utilizada anteriormente"), melhor marca e séries de hoje.
   */
  async executionView(sessionId: string) {
    const session = await this.prisma.workoutSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { workout: { include: workoutInclude }, sets: { orderBy: [{ completedAt: 'asc' }] } },
    });
    const exerciseIds = session.workout?.exercises.map((e) => e.exerciseId) ?? [];
    const previousSets = await this.prisma.workoutSet.findMany({
      where: {
        exerciseId: { in: exerciseIds },
        session: { studentId: session.studentId, status: SessionStatus.COMPLETED, id: { not: sessionId } },
      },
      orderBy: { completedAt: 'desc' },
      include: { session: { select: { id: true, startedAt: true } } },
    });

    const exercises = (session.workout?.exercises ?? []).map((we) => {
      const history = previousSets.filter((s) => s.exerciseId === we.exerciseId);
      const lastSessionId = history[0]?.session.id;
      const lastSets = history
        .filter((s) => s.session.id === lastSessionId)
        .sort((a, b) => a.setNumber - b.setNumber)
        .map((s) => ({ setNumber: s.setNumber, loadKg: num0(s.loadKg), reps: s.reps }));
      const best = bestSet(history.map((s) => ({ loadKg: num0(s.loadKg), reps: s.reps })));
      return {
        workoutExerciseId: we.id,
        exerciseId: we.exerciseId,
        order: we.order,
        name: we.exercise.name,
        muscleGroup: we.exercise.muscleGroup,
        imageUrl: we.exercise.imageUrl,
        videoUrl: we.exercise.videoUrl,
        instructions: we.exercise.instructions,
        sets: we.sets,
        reps: we.reps,
        suggestedLoadKg: num(we.suggestedLoadKg),
        restSeconds: we.restSeconds,
        technique: we.technique,
        groupKey: we.groupKey,
        notes: we.notes,
        previous: lastSets.length ? { date: history[0].session.startedAt, sets: lastSets } : null,
        personalBest: best,
        today: session.sets
          .filter((s) => s.exerciseId === we.exerciseId)
          .map((s) => ({
            id: s.id,
            setNumber: s.setNumber,
            loadKg: num0(s.loadKg),
            reps: s.reps,
            rpe: s.rpe,
            notes: s.notes,
            isPersonalRecord: s.isPersonalRecord,
          })),
      };
    });
    return {
      id: session.id,
      status: session.status,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      durationSeconds: session.durationSeconds,
      totalVolumeKg: num(session.totalVolumeKg),
      estimatedCalories: session.estimatedCalories,
      perceivedEffort: session.perceivedEffort,
      notes: session.notes,
      workout: session.workout ? { id: session.workout.id, name: session.workout.name, label: session.workout.label } : null,
      exercises,
    };
  }

  /** CONCLUIR SÉRIE: grava carga/repetições e retorna o descanso a cronometrar. */
  async logSet(studentId: string, sessionId: string, dto: LogSetDto) {
    const session = await this.ownOpenSession(studentId, sessionId);
    const workoutExercise = dto.workoutExerciseId
      ? await this.prisma.workoutExercise.findFirst({ where: { id: dto.workoutExerciseId, workoutId: session.workoutId ?? '' } })
      : await this.prisma.workoutExercise.findFirst({ where: { workoutId: session.workoutId ?? '', exerciseId: dto.exerciseId } });
    if (dto.workoutExerciseId && !workoutExercise) throw new NotFoundError('Exercício da ficha');

    const previous = await this.prisma.workoutSet.findMany({
      where: {
        exerciseId: dto.exerciseId,
        session: { studentId },
        NOT: { sessionId, setNumber: dto.setNumber },
      },
      select: { loadKg: true, reps: true },
    });
    const previousBest = bestSet(previous.map((s) => ({ loadKg: num0(s.loadKg), reps: s.reps })));
    const pr = isPersonalRecord({ loadKg: dto.loadKg, reps: dto.reps }, previousBest);

    const data = {
      workoutExerciseId: workoutExercise?.id,
      loadKg: dto.loadKg,
      reps: dto.reps,
      rpe: dto.rpe,
      notes: dto.notes,
      isPersonalRecord: pr,
      completedAt: new Date(),
    };
    const set = await this.prisma.workoutSet.upsert({
      where: { sessionId_exerciseId_setNumber: { sessionId, exerciseId: dto.exerciseId, setNumber: dto.setNumber } },
      create: { sessionId, exerciseId: dto.exerciseId, setNumber: dto.setNumber, ...data },
      update: data,
      include: { exercise: { select: { name: true } } },
    });

    if (pr) await this.notifyPersonalRecord(studentId, sessionId, dto.exerciseId, set.exercise.name, dto.loadKg);
    return {
      set: { ...set, loadKg: num0(set.loadKg) },
      isPersonalRecord: pr,
      restSeconds: workoutExercise?.restSeconds ?? 60,
    };
  }

  async deleteSet(studentId: string, sessionId: string, setId: string) {
    await this.ownOpenSession(studentId, sessionId);
    const { count } = await this.prisma.workoutSet.deleteMany({ where: { id: setId, sessionId } });
    if (!count) throw new NotFoundError('Série');
  }

  /** FINALIZAR TREINO: horário inicial/final, duração, volume total e calorias estimadas. */
  async finish(studentId: string, sessionId: string, dto: FinishSessionDto) {
    const session = await this.ownOpenSession(studentId, sessionId);
    const [sets, student] = await Promise.all([
      this.prisma.workoutSet.findMany({ where: { sessionId }, include: { exercise: { select: { name: true } } } }),
      this.prisma.student.findUniqueOrThrow({ where: { id: studentId } }),
    ]);
    const finishedAt = new Date();
    const durationSeconds = Math.max(0, Math.round((finishedAt.getTime() - session.startedAt.getTime()) / 1000));
    const volume = totalVolume(sets.map((s) => ({ loadKg: num0(s.loadKg), reps: s.reps })));
    const estimatedCalories = estimateCalories({
      durationSeconds,
      bodyWeightKg: num(student.currentWeightKg),
      perceivedEffort: dto.perceivedEffort,
    });

    await this.prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.COMPLETED,
        finishedAt,
        durationSeconds,
        totalVolumeKg: volume,
        estimatedCalories,
        perceivedEffort: dto.perceivedEffort,
        notes: dto.notes,
      },
    });

    const completedCount = await this.prisma.workoutSession.count({ where: { studentId, status: SessionStatus.COMPLETED } });
    if (isWorkoutMilestone(completedCount)) {
      await this.notifications.notify(student.userId, {
        type: NotificationType.MILESTONE,
        title: 'Parabéns! 🏆',
        body: completedCount === 1 ? 'Você completou seu primeiro treino!' : `Parabéns! Você completou ${completedCount} treinos.`,
        dedupeKey: `milestone:${completedCount}`,
      });
    }
    await this.goals.refreshForStudent(studentId);

    return {
      ...(await this.executionView(sessionId)),
      summary: {
        startedAt: session.startedAt,
        finishedAt,
        durationSeconds,
        totalVolumeKg: volume,
        estimatedCalories,
        setsCount: sets.length,
        exercisesCount: new Set(sets.map((s) => s.exerciseId)).size,
        personalRecords: sets.filter((s) => s.isPersonalRecord).map((s) => ({ exercise: s.exercise.name, loadKg: num0(s.loadKg), reps: s.reps })),
        totalWorkouts: completedCount,
      },
    };
  }

  async abandon(studentId: string, sessionId: string) {
    await this.ownOpenSession(studentId, sessionId);
    await this.prisma.workoutSession.update({ where: { id: sessionId }, data: { status: SessionStatus.ABANDONED } });
  }

  /** Histórico de treinos (calendário/lista). */
  async history(user: AuthUser, q: SessionHistoryQuery) {
    const studentId = await this.access.resolveStudentId(user, q.studentId);
    const where: Prisma.WorkoutSessionWhereInput = {
      studentId,
      status: SessionStatus.COMPLETED,
      startedAt: { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined },
    };
    const [items, total] = await Promise.all([
      this.prisma.workoutSession.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        include: { workout: { select: { id: true, name: true, label: true } }, _count: { select: { sets: true } } },
        ...paginate(q),
      }),
      this.prisma.workoutSession.count({ where }),
    ]);
    return {
      items: items.map((s) => ({
        id: s.id,
        workout: s.workout,
        startedAt: s.startedAt,
        finishedAt: s.finishedAt,
        durationSeconds: s.durationSeconds,
        totalVolumeKg: num(s.totalVolumeKg),
        estimatedCalories: s.estimatedCalories,
        perceivedEffort: s.perceivedEffort,
        setsCount: s._count.sets,
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  private async ownOpenSession(studentId: string, sessionId: string) {
    const session = await this.prisma.workoutSession.findFirst({ where: { id: sessionId, studentId } });
    if (!session) throw new NotFoundError('Sessão');
    if (session.status !== SessionStatus.IN_PROGRESS) throw new ConflictError('Este treino já foi encerrado');
    return session;
  }

  private async notifyPersonalRecord(studentId: string, sessionId: string, exerciseId: string, name: string, loadKg: number) {
    const student = await this.prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { user: true } });
    await this.notifications.notify(student.userId, {
      type: NotificationType.PERSONAL_RECORD,
      title: 'Novo recorde! 💪',
      body: `Você bateu seu recorde no ${name.toLowerCase()}: ${loadKg.toLocaleString('pt-BR')} kg.`,
      data: { exerciseId, sessionId },
      dedupeKey: `pr:${sessionId}:${exerciseId}`,
    });
    const link = await this.access.primaryLinkForStudent(studentId);
    if (link) {
      const trainer = await this.prisma.trainer.findUniqueOrThrow({ where: { id: link.trainerId } });
      await this.notifications.notify(trainer.userId, {
        type: NotificationType.PERSONAL_RECORD,
        title: 'Recorde de aluno',
        body: `${student.user.name} bateu o recorde no ${name.toLowerCase()}: ${loadKg.toLocaleString('pt-BR')} kg.`,
        data: { exerciseId, studentId },
        dedupeKey: `pr:${sessionId}:${exerciseId}`,
      });
    }
  }
}
