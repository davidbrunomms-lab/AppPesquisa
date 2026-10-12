import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma, SessionStatus } from '@prisma/client';
import { AccessPolicyService } from '../../../common/access/access-policy.service';
import type { AuthUser } from '../../../common/auth/auth-user';
import { NotFoundError } from '../../../common/errors/domain-errors';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ExercisesService } from '../../exercises/application/exercises.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { AssignWorkoutDto, ListWorkoutsQuery, SaveWorkoutDto } from '../presentation/workouts.dto';

export const workoutInclude = {
  exercises: { orderBy: { order: 'asc' }, include: { exercise: true } },
} satisfies Prisma.WorkoutInclude;

@Injectable()
export class WorkoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
    private readonly exercises: ExercisesService,
    private readonly notifications: NotificationsService,
  ) {}

  list(trainerId: string, q: ListWorkoutsQuery) {
    return this.prisma.workout.findMany({
      where: {
        trainerId,
        ...(q.templates !== undefined ? { isTemplate: q.templates } : {}),
        ...(q.studentId ? { studentWorkouts: { some: { studentId: q.studentId } } } : {}),
      },
      include: {
        ...workoutInclude,
        studentWorkouts: { include: { student: { include: { user: { select: { name: true, avatarUrl: true } } } } } },
      },
      orderBy: [{ label: 'asc' }, { name: 'asc' }],
    });
  }

  /** Professor dono ou aluno com a ficha atribuída. */
  async get(user: AuthUser, id: string) {
    const where: Prisma.WorkoutWhereInput =
      user.role === 'TRAINER'
        ? { id, trainerId: user.trainerId! }
        : { id, studentWorkouts: { some: { studentId: user.studentId ?? '' } } };
    const workout = await this.prisma.workout.findFirst({ where, include: workoutInclude });
    if (!workout) throw new NotFoundError('Treino');
    return workout;
  }

  async create(trainerId: string, dto: SaveWorkoutDto) {
    await this.exercises.assertUsable(trainerId, dto.exercises.map((e) => e.exerciseId));
    return this.prisma.workout.create({
      data: {
        trainerId,
        name: dto.name,
        label: dto.label,
        description: dto.description,
        isTemplate: dto.isTemplate ?? false,
        exercises: { create: dto.exercises.map((e, i) => this.exerciseData(e, i)) },
      },
      include: workoutInclude,
    });
  }

  /** Atualiza a ficha preservando itens com id (histórico e sugestões continuam válidos). */
  async update(trainerId: string, id: string, dto: SaveWorkoutDto) {
    const current = await this.assertOwn(trainerId, id);
    await this.exercises.assertUsable(trainerId, dto.exercises.map((e) => e.exerciseId));
    const currentIds = new Set(current.exercises.map((e) => e.id));
    const keepIds = dto.exercises.filter((e) => e.id && currentIds.has(e.id)).map((e) => e.id!);

    const workout = await this.prisma.$transaction(async (tx) => {
      await tx.workoutExercise.deleteMany({ where: { workoutId: id, id: { notIn: keepIds } } });
      for (const [i, e] of dto.exercises.entries()) {
        if (e.id && currentIds.has(e.id)) {
          await tx.workoutExercise.update({ where: { id: e.id }, data: this.exerciseData(e, i) });
        } else {
          await tx.workoutExercise.create({ data: { ...this.exerciseData(e, i), workoutId: id } });
        }
      }
      return tx.workout.update({
        where: { id },
        data: { name: dto.name, label: dto.label, description: dto.description, isTemplate: dto.isTemplate },
        include: workoutInclude,
      });
    });
    await this.notifyAssigned(id, 'Seu professor atualizou seu treino.');
    return workout;
  }

  async remove(trainerId: string, id: string) {
    await this.assertOwn(trainerId, id);
    await this.prisma.workout.delete({ where: { id } });
  }

  async duplicate(trainerId: string, id: string) {
    const source = await this.assertOwn(trainerId, id);
    return this.prisma.workout.create({
      data: {
        trainerId,
        name: `${source.name} (cópia)`,
        label: source.label,
        description: source.description,
        isTemplate: source.isTemplate,
        exercises: {
          create: source.exercises.map(({ exerciseId, order, sets, reps, suggestedLoadKg, restSeconds, technique, groupKey, notes }) => ({
            exerciseId, order, sets, reps, suggestedLoadKg, restSeconds, technique, groupKey, notes,
          })),
        },
      },
      include: workoutInclude,
    });
  }

  async assign(trainerId: string, workoutId: string, dto: AssignWorkoutDto) {
    await this.assertOwn(trainerId, workoutId);
    await this.access.assertTrainerCanAccessStudent(trainerId, dto.studentId);
    const assignment = await this.prisma.studentWorkout.upsert({
      where: { studentId_workoutId: { studentId: dto.studentId, workoutId } },
      create: { studentId: dto.studentId, workoutId, weekdays: dto.weekdays ?? [], order: dto.order ?? 0 },
      update: { weekdays: dto.weekdays, order: dto.order, active: true, endsAt: null },
    });
    const student = await this.prisma.student.findUniqueOrThrow({ where: { id: dto.studentId } });
    await this.notifications.notify(student.userId, {
      type: NotificationType.WORKOUT_UPDATED,
      title: 'Novo treino disponível',
      body: 'Seu professor atualizou seu treino.',
      data: { workoutId },
    });
    return assignment;
  }

  async unassign(trainerId: string, workoutId: string, studentId: string) {
    await this.assertOwn(trainerId, workoutId);
    await this.access.assertTrainerCanAccessStudent(trainerId, studentId);
    await this.prisma.studentWorkout.updateMany({
      where: { workoutId, studentId },
      data: { active: false, endsAt: new Date() },
    });
  }

  /** Fichas ativas do aluno (para professor vinculado ou o próprio aluno). */
  async forStudent(user: AuthUser, studentIdParam?: string) {
    const studentId = await this.access.resolveStudentId(user, studentIdParam);
    const assignments = await this.prisma.studentWorkout.findMany({
      where: {
        studentId,
        active: true,
        ...(user.role === 'TRAINER' ? { workout: { trainerId: user.trainerId! } } : {}),
      },
      include: { workout: { include: workoutInclude } },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return assignments.map((a) => ({
      assignmentId: a.id,
      weekdays: a.weekdays,
      order: a.order,
      startsAt: a.startsAt,
      ...a.workout,
    }));
  }

  /**
   * "Treino do dia": ficha agendada para hoje; senão, a próxima da rotação
   * (após a última ficha concluída, seguindo a ordem definida pelo professor).
   */
  async today(studentId: string, reference = new Date()) {
    const assignments = await this.prisma.studentWorkout.findMany({
      where: { studentId, active: true },
      include: { workout: { include: workoutInclude } },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    if (!assignments.length) return null;

    const weekday = reference.getDay();
    const scheduled = assignments.find((a) => a.weekdays.includes(weekday));
    let chosen = scheduled;
    if (!chosen) {
      const last = await this.prisma.workoutSession.findFirst({
        where: { studentId, status: SessionStatus.COMPLETED, workoutId: { not: null } },
        orderBy: { startedAt: 'desc' },
      });
      const lastIndex = assignments.findIndex((a) => a.workoutId === last?.workoutId);
      chosen = assignments[(lastIndex + 1) % assignments.length];
    }
    const doneToday = await this.prisma.workoutSession.findFirst({
      where: {
        studentId,
        workoutId: chosen.workoutId,
        status: SessionStatus.COMPLETED,
        startedAt: { gte: new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()) },
      },
    });
    return { assignmentId: chosen.id, scheduledForToday: Boolean(scheduled), completedToday: Boolean(doneToday), ...chosen.workout };
  }

  private exerciseData(e: SaveWorkoutDto['exercises'][number], order: number) {
    return {
      exerciseId: e.exerciseId,
      order,
      sets: e.sets,
      reps: e.reps,
      suggestedLoadKg: e.suggestedLoadKg,
      restSeconds: e.restSeconds ?? 60,
      technique: e.technique ?? 'NORMAL',
      groupKey: e.groupKey,
      notes: e.notes,
    };
  }

  private async assertOwn(trainerId: string, id: string) {
    const workout = await this.prisma.workout.findFirst({ where: { id, trainerId }, include: workoutInclude });
    if (!workout) throw new NotFoundError('Treino');
    return workout;
  }

  private async notifyAssigned(workoutId: string, body: string) {
    const assigned = await this.prisma.studentWorkout.findMany({
      where: { workoutId, active: true },
      include: { student: { select: { userId: true } } },
    });
    await Promise.all(
      assigned.map((a) =>
        this.notifications.notify(a.student.userId, {
          type: NotificationType.WORKOUT_UPDATED,
          title: 'Treino atualizado',
          body,
          data: { workoutId },
        }),
      ),
    );
  }
}
