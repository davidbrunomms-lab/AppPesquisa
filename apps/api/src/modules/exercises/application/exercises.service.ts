import { Injectable } from '@nestjs/common';
import { LinkStatus, Prisma } from '@prisma/client';
import type { AuthUser } from '../../../common/auth/auth-user';
import { ConflictError, NotFoundError } from '../../../common/errors/domain-errors';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateExerciseDto, ListExercisesQuery, UpdateExerciseDto } from '../presentation/exercises.dto';

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Professores visíveis ao usuário: o próprio (professor) ou os vinculados (aluno). */
  private async visibleTrainerIds(user: AuthUser): Promise<string[]> {
    if (user.role === 'TRAINER') return [user.trainerId!];
    if (user.role === 'STUDENT') {
      const links = await this.prisma.trainerStudent.findMany({
        where: { studentId: user.studentId!, status: { not: LinkStatus.INACTIVE } },
        select: { trainerId: true },
      });
      return links.map((l) => l.trainerId);
    }
    return [];
  }

  async visibilityFilter(user: AuthUser): Promise<Prisma.ExerciseWhereInput> {
    return { archivedAt: null, OR: [{ trainerId: null }, { trainerId: { in: await this.visibleTrainerIds(user) } }] };
  }

  async list(user: AuthUser, q: ListExercisesQuery) {
    const scope: Prisma.ExerciseWhereInput =
      q.scope === 'library'
        ? { trainerId: null, archivedAt: null }
        : q.scope === 'custom'
          ? { trainerId: { in: await this.visibleTrainerIds(user) }, archivedAt: null }
          : await this.visibilityFilter(user);
    return this.prisma.exercise.findMany({
      where: {
        AND: [
          scope,
          q.muscleGroup ? { muscleGroup: q.muscleGroup } : {},
          q.search ? { name: { contains: q.search.trim(), mode: 'insensitive' } } : {},
        ],
      },
      orderBy: [{ muscleGroup: 'asc' }, { name: 'asc' }],
    });
  }

  async get(user: AuthUser, id: string) {
    const exercise = await this.prisma.exercise.findFirst({ where: { AND: [{ id }, await this.visibilityFilter(user)] } });
    if (!exercise) throw new NotFoundError('Exercício');
    return exercise;
  }

  /** Garante que todos os exercícios existem e são visíveis ao professor. */
  async assertUsable(trainerId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    const count = await this.prisma.exercise.count({
      where: { id: { in: unique }, archivedAt: null, OR: [{ trainerId: null }, { trainerId }] },
    });
    if (count !== unique.length) throw new NotFoundError('Exercício');
  }

  create(trainerId: string, dto: CreateExerciseDto) {
    return this.prisma.exercise.create({ data: { ...dto, trainerId } });
  }

  async update(trainerId: string, id: string, dto: UpdateExerciseDto) {
    await this.assertOwn(trainerId, id);
    return this.prisma.exercise.update({ where: { id }, data: dto });
  }

  async remove(trainerId: string, id: string) {
    await this.assertOwn(trainerId, id);
    const used = await this.prisma.workoutExercise.count({ where: { exerciseId: id } });
    const logged = await this.prisma.workoutSet.count({ where: { exerciseId: id } });
    if (used || logged) throw new ConflictError('Exercício em uso em fichas ou históricos; remova-o das fichas antes');
    await this.prisma.exercise.delete({ where: { id } });
  }

  private async assertOwn(trainerId: string, id: string) {
    const exercise = await this.prisma.exercise.findFirst({ where: { id, trainerId } });
    if (!exercise) throw new NotFoundError('Exercício personalizado');
    return exercise;
  }
}
