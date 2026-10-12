import { addDays, daysBetween, startOfMonth, startOfWeek, toDateKey } from './dates';
import { clamp, round } from './math';

export interface SessionLike {
  startedAt: Date | string;
  durationSeconds?: number | null;
}

export interface TrainingStats {
  /** Treinos no mês de referência. */
  monthCount: number;
  /** Treinos na semana de referência. */
  weekCount: number;
  /** Média de treinos por semana nas últimas 4 semanas. */
  weeklyAverage: number;
  /** Média de treinos por mês nos últimos 3 meses. */
  monthlyAverage: number;
  /** Duração média (s). */
  averageDurationSeconds: number;
  /** Dias distintos treinados (yyyy-mm-dd), para o calendário. */
  trainedDays: string[];
  /** Dias consecutivos (até hoje/ontem) com treino. */
  currentStreakDays: number;
}

export function trainingStats(sessions: SessionLike[], reference = new Date()): TrainingStats {
  const dates = sessions.map((s) => new Date(s.startedAt));
  const weekStart = startOfWeek(reference);
  const monthStart = startOfMonth(reference);
  const fourWeeksAgo = addDays(weekStart, -21);
  const threeMonthsAgo = new Date(reference.getFullYear(), reference.getMonth() - 2, 1);

  const durations = sessions.map((s) => s.durationSeconds ?? 0).filter((d) => d > 0);
  const trainedDays = [...new Set(dates.map(toDateKey))].sort();

  return {
    monthCount: dates.filter((d) => d >= monthStart && d <= reference).length,
    weekCount: dates.filter((d) => d >= weekStart && d <= reference).length,
    weeklyAverage: round(dates.filter((d) => d >= fourWeeksAgo && d <= reference).length / 4, 1),
    monthlyAverage: round(dates.filter((d) => d >= threeMonthsAgo && d <= reference).length / 3, 1),
    averageDurationSeconds: durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0,
    trainedDays,
    currentStreakDays: dayStreak(trainedDays, reference),
  };
}

/** Dias consecutivos (até hoje ou ontem) com treino registrado. */
export function dayStreak(trainedDays: string[], reference = new Date()): number {
  const set = new Set(trainedDays);
  let cursor = new Date(reference);
  if (!set.has(toDateKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (set.has(toDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Taxa de frequência (%) = treinos realizados / treinos planejados no período. */
export function attendanceRate(done: number, plannedPerWeek: number, weeks = 1): number {
  const planned = plannedPerWeek * weeks;
  if (planned <= 0) return 0;
  return round(clamp((done / planned) * 100, 0, 100), 0);
}

/** Série semanal (últimas N semanas) para o gráfico de frequência. */
export function weeklyFrequencySeries(
  sessions: SessionLike[],
  weeks = 8,
  reference = new Date(),
): { weekStart: string; count: number }[] {
  const currentWeek = startOfWeek(reference);
  const series = Array.from({ length: weeks }, (_, i) => ({
    weekStart: toDateKey(addDays(currentWeek, -7 * (weeks - 1 - i))),
    count: 0,
  }));
  for (const s of sessions) {
    const key = toDateKey(startOfWeek(new Date(s.startedAt)));
    const bucket = series.find((w) => w.weekStart === key);
    if (bucket) bucket.count += 1;
  }
  return series;
}

export function daysSinceLastWorkout(lastWorkoutAt: Date | string | null | undefined, reference = new Date()): number | null {
  if (!lastWorkoutAt) return null;
  return daysBetween(new Date(lastWorkoutAt), reference);
}

/** Aluno considerado "sem treinar recentemente" a partir deste número de dias. */
export const INACTIVITY_THRESHOLD_DAYS = 3;
