import { Injectable } from '@nestjs/common';
import { GoalStatus, GoalType, NotificationType, SessionStatus, StudentGoal } from '@prisma/client';
import { goalProgress, startOfWeek } from '@personalpro/shared';
import { AccessPolicyService } from '../../../common/access/access-policy.service';
import type { AuthUser } from '../../../common/auth/auth-user';
import { DomainError, NotFoundError } from '../../../common/errors/domain-errors';
import { num, num0 } from '../../../common/utils/decimal';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { CreateGoalDto, UpdateGoalDto } from '../presentation/goals.dto';

const UNITS: Record<GoalType, string> = {
  BODY_WEIGHT: 'kg',
  BODY_FAT: '%',
  WEEKLY_FREQUENCY: 'treinos/semana',
  EXERCISE_LOAD: 'kg',
  CUSTOM: '',
};

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
    private readonly notifications: NotificationsService,
  ) {}

  serialize(goal: StudentGoal & { exercise?: { name: string } | null }) {
    const values = {
      startValue: num0(goal.startValue),
      currentValue: num0(goal.currentValue),
      targetValue: num0(goal.targetValue),
    };
    return { ...goal, ...values, progressPct: goalProgress(values), exerciseName: goal.exercise?.name ?? null };
  }

  async list(user: AuthUser, studentIdParam?: string, status?: GoalStatus) {
    const studentId = await this.access.resolveStudentId(user, studentIdParam);
    await this.refreshForStudent(studentId, { notify: false });
    const goals = await this.prisma.studentGoal.findMany({
      where: { studentId, status },
      include: { exercise: { select: { name: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    return goals.map((g) => this.serialize(g));
  }

  async create(trainerId: string, dto: CreateGoalDto) {
    await this.access.assertTrainerCanAccessStudent(trainerId, dto.studentId);
    if (dto.type === GoalType.EXERCISE_LOAD && !dto.exerciseId) {
      throw new DomainError('Informe o exercício da meta de carga', 'EXERCISE_REQUIRED');
    }
    if (dto.type === GoalType.CUSTOM && !(dto.title && dto.unit)) {
      throw new DomainError('Metas personalizadas exigem título e unidade', 'TITLE_REQUIRED');
    }
    const measured = await this.measure(dto.studentId, dto.type, dto.exerciseId);
    const startValue = dto.startValue ?? measured ?? 0;
    const exercise = dto.exerciseId ? await this.prisma.exercise.findUnique({ where: { id: dto.exerciseId } }) : null;
    if (dto.exerciseId && !exercise) throw new NotFoundError('Exercício');

    const goal = await this.prisma.studentGoal.create({
      data: {
        studentId: dto.studentId,
        trainerId,
        type: dto.type,
        exerciseId: dto.exerciseId,
        title: dto.title ?? this.defaultTitle(dto.type, dto.targetValue, startValue, exercise?.name),
        unit: dto.unit ?? UNITS[dto.type],
        startValue,
        currentValue: measured ?? startValue,
        targetValue: dto.targetValue,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
      include: { exercise: { select: { name: true } } },
    });
    const student = await this.prisma.student.findUniqueOrThrow({ where: { id: dto.studentId } });
    await this.notifications.notify(student.userId, {
      type: NotificationType.GOAL,
      title: 'Nova meta',
      body: `Seu professor definiu uma nova meta: ${goal.title}.`,
      data: { goalId: goal.id },
    });
    return this.serialize(goal);
  }

  async update(trainerId: string, id: string, dto: UpdateGoalDto) {
    const goal = await this.prisma.studentGoal.findFirst({ where: { id, trainerId } });
    if (!goal) throw new NotFoundError('Meta');
    await this.access.assertTrainerCanAccessStudent(trainerId, goal.studentId);
    const updated = await this.prisma.studentGoal.update({
      where: { id },
      data: {
        title: dto.title,
        targetValue: dto.targetValue,
        currentValue: dto.currentValue,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        status: dto.status,
        achievedAt: dto.status === GoalStatus.ACHIEVED ? new Date() : undefined,
      },
      include: { exercise: { select: { name: true } } },
    });
    await this.refreshForStudent(goal.studentId);
    return this.serialize(updated);
  }

  async remove(trainerId: string, id: string) {
    const { count } = await this.prisma.studentGoal.deleteMany({ where: { id, trainerId } });
    if (!count) throw new NotFoundError('Meta');
  }

  /** Valor atual medido automaticamente para cada tipo de meta. */
  async measure(studentId: string, type: GoalType, exerciseId?: string | null): Promise<number | null> {
    switch (type) {
      case GoalType.BODY_WEIGHT: {
        const s = await this.prisma.student.findUnique({ where: { id: studentId } });
        return num(s?.currentWeightKg);
      }
      case GoalType.BODY_FAT: {
        const a = await this.prisma.bodyAssessment.findFirst({
          where: { studentId, status: 'COMPLETED', bodyFatPct: { not: null } },
          orderBy: { assessedAt: 'desc' },
        });
        return num(a?.bodyFatPct);
      }
      case GoalType.WEEKLY_FREQUENCY:
        return this.prisma.workoutSession.count({
          where: { studentId, status: SessionStatus.COMPLETED, startedAt: { gte: startOfWeek(new Date()) } },
        });
      case GoalType.EXERCISE_LOAD: {
        if (!exerciseId) return null;
        const best = await this.prisma.workoutSet.aggregate({
          where: { exerciseId, session: { studentId } },
          _max: { loadKg: true },
        });
        return num(best._max.loadKg);
      }
      default:
        return null;
    }
  }

  /** Atualiza o valor atual das metas ativas e marca as alcançadas (com notificação). */
  async refreshForStudent(studentId: string, opts: { notify?: boolean } = {}) {
    const goals = await this.prisma.studentGoal.findMany({ where: { studentId, status: GoalStatus.ACTIVE } });
    for (const goal of goals) {
      const measured = goal.type === GoalType.CUSTOM ? null : await this.measure(studentId, goal.type, goal.exerciseId);
      const currentValue = measured ?? num0(goal.currentValue);
      const progress = goalProgress({ startValue: num0(goal.startValue), currentValue, targetValue: num0(goal.targetValue) });
      // Meta de frequência semanal não "conclui" de forma definitiva: é recorrente
      const achieved = progress >= 100 && goal.type !== GoalType.WEEKLY_FREQUENCY;
      if (currentValue === num0(goal.currentValue) && !achieved) continue;
      await this.prisma.studentGoal.update({
        where: { id: goal.id },
        data: {
          currentValue,
          ...(achieved ? { status: GoalStatus.ACHIEVED, achievedAt: new Date() } : {}),
        },
      });
      if (achieved && opts.notify !== false) await this.notifyAchieved(goal);
    }
  }

  private async notifyAchieved(goal: StudentGoal) {
    const student = await this.prisma.student.findUniqueOrThrow({ where: { id: goal.studentId }, include: { user: true } });
    await this.notifications.notify(student.userId, {
      type: NotificationType.GOAL,
      title: 'Meta alcançada! 🎉',
      body: `Parabéns! Você alcançou a meta: ${goal.title}.`,
      data: { goalId: goal.id },
    });
    if (goal.trainerId) {
      const trainer = await this.prisma.trainer.findUnique({ where: { id: goal.trainerId } });
      if (trainer) {
        await this.notifications.notify(trainer.userId, {
          type: NotificationType.GOAL,
          title: 'Meta alcançada',
          body: `${student.user.name} alcançou a meta: ${goal.title}.`,
          data: { goalId: goal.id, studentId: goal.studentId },
        });
      }
    }
  }

  private defaultTitle(type: GoalType, target: number, start: number, exerciseName?: string) {
    const fmt = (n: number) => n.toLocaleString('pt-BR');
    switch (type) {
      case GoalType.BODY_WEIGHT:
        return `Chegar a ${fmt(target)} kg`;
      case GoalType.BODY_FAT:
        return target < start ? `Reduzir gordura corporal para ${fmt(target)}%` : `Gordura corporal em ${fmt(target)}%`;
      case GoalType.WEEKLY_FREQUENCY:
        return `Treinar ${fmt(target)} vezes por semana`;
      case GoalType.EXERCISE_LOAD:
        return `${exerciseName ?? 'Exercício'} ${fmt(target)} kg`;
      default:
        return 'Meta personalizada';
    }
  }
}
