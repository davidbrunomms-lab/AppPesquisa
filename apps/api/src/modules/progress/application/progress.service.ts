import { Injectable } from '@nestjs/common';
import { SessionStatus } from '@prisma/client';
import {
  BODY_MEASUREMENT_KEYS,
  estimateOneRepMax,
  evolution,
  loadProgression,
  toDateKey,
  trainingStats,
  weeklyFrequencySeries,
} from '@personalpro/shared';
import { AccessPolicyService } from '../../../common/access/access-policy.service';
import type { AuthUser } from '../../../common/auth/auth-user';
import { NotFoundError } from '../../../common/errors/domain-errors';
import { num, num0 } from '../../../common/utils/decimal';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
  ) {}

  /** Frequência: treinos no mês, médias semanal/mensal, duração média, calendário e gráficos. */
  async stats(user: AuthUser, studentIdParam: string | undefined, weeks: number) {
    const studentId = await this.access.resolveStudentId(user, studentIdParam);
    const [student, sessions] = await Promise.all([
      this.prisma.student.findUniqueOrThrow({ where: { id: studentId } }),
      this.prisma.workoutSession.findMany({
        where: { studentId, status: SessionStatus.COMPLETED },
        select: { startedAt: true, durationSeconds: true, totalVolumeKg: true },
        orderBy: { startedAt: 'asc' },
      }),
    ]);
    const now = new Date();
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const key = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}`;
      return { month: key, count: sessions.filter((s) => toDateKey(s.startedAt).startsWith(key)).length };
    });
    return {
      ...trainingStats(sessions, now),
      plannedPerWeek: student.weeklyFrequency,
      totalWorkouts: sessions.length,
      totalVolumeKg: Math.round(sessions.reduce((acc, s) => acc + num0(s.totalVolumeKg), 0)),
      weeklySeries: weeklyFrequencySeries(sessions, weeks, now),
      monthlySeries: monthly,
    };
  }

  /** Exercícios já executados com última carga, melhor carga e variação. */
  async exercises(user: AuthUser, studentIdParam?: string) {
    const studentId = await this.access.resolveStudentId(user, studentIdParam);
    const sets = await this.prisma.workoutSet.findMany({
      where: { session: { studentId, status: SessionStatus.COMPLETED } },
      include: { exercise: { select: { id: true, name: true, muscleGroup: true } } },
      orderBy: { completedAt: 'asc' },
    });
    const byExercise = new Map<string, typeof sets>();
    for (const s of sets) byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s]);
    return [...byExercise.values()]
      .map((list) => {
        const points = loadProgression(list.map((s) => ({ completedAt: s.completedAt, loadKg: num0(s.loadKg), reps: s.reps })));
        const first = points[0];
        const last = points[points.length - 1];
        return {
          exerciseId: list[0].exercise.id,
          name: list[0].exercise.name,
          muscleGroup: list[0].exercise.muscleGroup,
          sessions: points.length,
          firstLoadKg: first.loadKg,
          lastLoadKg: last.loadKg,
          bestLoadKg: Math.max(...points.map((p) => p.loadKg)),
          deltaKg: Math.round((last.loadKg - first.loadKg) * 10) / 10,
          lastDate: last.date,
        };
      })
      .sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  }

  /** Progressão de carga de um exercício (ex.: Supino reto 01/09 60 kg → 22/09 72 kg). */
  async exercise(user: AuthUser, exerciseId: string, studentIdParam?: string) {
    const studentId = await this.access.resolveStudentId(user, studentIdParam);
    const exercise = await this.prisma.exercise.findUnique({ where: { id: exerciseId } });
    if (!exercise) throw new NotFoundError('Exercício');
    const sets = await this.prisma.workoutSet.findMany({
      where: { exerciseId, session: { studentId, status: SessionStatus.COMPLETED } },
      orderBy: { completedAt: 'asc' },
    });
    const points = loadProgression(sets.map((s) => ({ completedAt: s.completedAt, loadKg: num0(s.loadKg), reps: s.reps })));
    return {
      exercise: { id: exercise.id, name: exercise.name, muscleGroup: exercise.muscleGroup },
      points: points.map((p) => ({ ...p, estimatedOneRepMaxKg: estimateOneRepMax(p) })),
      evolution: points.length ? evolution(points[0].loadKg, points[points.length - 1].loadKg) : null,
    };
  }

  /** Séries para os gráficos de peso, % gordura, massa muscular e medidas. */
  async body(user: AuthUser, studentIdParam?: string) {
    const studentId = await this.access.resolveStudentId(user, studentIdParam);
    const [student, assessments] = await Promise.all([
      this.prisma.student.findUniqueOrThrow({ where: { id: studentId } }),
      this.prisma.bodyAssessment.findMany({
        where: { studentId, status: 'COMPLETED' },
        include: { measurements: true },
        orderBy: { assessedAt: 'asc' },
      }),
    ]);
    const series = assessments.map((a) => ({
      assessmentId: a.id,
      date: a.assessedAt,
      weightKg: num(a.weightKg),
      bmi: num(a.bmi),
      bodyFatPct: num(a.bodyFatPct),
      muscleMassKg: num(a.muscleMassKg),
      leanMassKg: num(a.leanMassKg),
      visceralFat: num(a.visceralFat),
      measurements: Object.fromEntries(
        BODY_MEASUREMENT_KEYS.map((k) => [k, num(a.measurements?.[k])]),
      ) as Record<(typeof BODY_MEASUREMENT_KEYS)[number], number | null>,
    }));
    const firstLast = (pick: (p: (typeof series)[number]) => number | null) => {
      const values = series.map(pick).filter((v): v is number => v !== null);
      return values.length ? evolution(values[0], values[values.length - 1]) : null;
    };
    const initialWeight = num(student.initialWeightKg);
    const currentWeight = num(student.currentWeightKg);
    return {
      weight:
        initialWeight !== null && currentWeight !== null ? evolution(initialWeight, currentWeight) : firstLast((p) => p.weightKg),
      bodyFat: firstLast((p) => p.bodyFatPct),
      muscleMass: firstLast((p) => p.muscleMassKg),
      series,
    };
  }
}
