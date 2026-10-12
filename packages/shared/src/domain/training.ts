import { round } from './math';

export interface SetLike {
  loadKg: number;
  reps: number;
}

export const setVolume = ({ loadKg, reps }: SetLike): number => (loadKg > 0 && reps > 0 ? loadKg * reps : 0);

/** Volume total (Σ carga × repetições). */
export const totalVolume = (sets: SetLike[]): number => round(sets.reduce((acc, s) => acc + setVolume(s), 0), 2);

/** 1RM estimado pela fórmula de Epley. */
export function estimateOneRepMax({ loadKg, reps }: SetLike): number {
  if (loadKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return loadKg;
  return round(loadKg * (1 + reps / 30), 1);
}

/**
 * Uma série é recorde pessoal quando a carga supera a maior carga já registrada
 * para o exercício, ou quando iguala a carga com mais repetições.
 */
export function isPersonalRecord(set: SetLike, previousBest: SetLike | null): boolean {
  if (set.loadKg <= 0 || set.reps <= 0) return false;
  if (!previousBest) return false; // primeira execução não conta como recorde
  if (set.loadKg > previousBest.loadKg) return true;
  return set.loadKg === previousBest.loadKg && set.reps > previousBest.reps;
}

export function bestSet<T extends SetLike>(sets: T[]): T | null {
  return sets.reduce<T | null>((best, s) => {
    if (!best) return s;
    if (s.loadKg > best.loadKg) return s;
    if (s.loadKg === best.loadKg && s.reps > best.reps) return s;
    return best;
  }, null);
}

/**
 * Calorias estimadas para musculação usando METs (Compendium of Physical Activities):
 * leve 3,5 · moderado 5,0 · vigoroso 6,0. A intensidade vem da percepção de esforço (RPE 1–10).
 */
export function estimateCalories(params: {
  durationSeconds: number;
  bodyWeightKg: number | null | undefined;
  perceivedEffort?: number | null;
}): number | null {
  const { durationSeconds, bodyWeightKg, perceivedEffort } = params;
  if (!bodyWeightKg || durationSeconds <= 0) return null;
  const rpe = perceivedEffort ?? 6;
  const met = rpe >= 8 ? 6 : rpe <= 4 ? 3.5 : 5;
  return Math.round(met * bodyWeightKg * (durationSeconds / 3600));
}

export interface LoadPoint {
  date: string; // ISO (yyyy-mm-dd)
  loadKg: number;
  reps: number;
}

/**
 * Histórico de progressão de carga por dia (melhor série de cada sessão).
 * Ex.: Supino reto — 01/09 60 kg · 08/09 65 kg · 15/09 70 kg.
 */
export function loadProgression(
  sets: { completedAt: Date | string; loadKg: number; reps: number }[],
): LoadPoint[] {
  const byDay = new Map<string, SetLike>();
  for (const s of sets) {
    const day = new Date(s.completedAt).toISOString().slice(0, 10);
    const current = byDay.get(day);
    const candidate = { loadKg: s.loadKg, reps: s.reps };
    if (!current || bestSet([current, candidate]) === candidate) byDay.set(day, candidate);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, s]) => ({ date, loadKg: s.loadKg, reps: s.reps }));
}

/** Marcos de quantidade de treinos que geram notificação de parabéns. */
export const WORKOUT_MILESTONES = [1, 10, 20, 30, 50, 75, 100, 150, 200, 300, 500, 1000];

export const isWorkoutMilestone = (completedCount: number): boolean =>
  WORKOUT_MILESTONES.includes(completedCount);

/** Converte "8-12" / "10" / "até a falha" em um número alvo (limite superior). */
export function parseTargetReps(reps: string): number | null {
  const numbers = reps.match(/\d+/g)?.map(Number);
  if (!numbers?.length) return null;
  return Math.max(...numbers);
}
