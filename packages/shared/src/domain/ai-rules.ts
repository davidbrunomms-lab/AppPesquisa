/**
 * Motor de regras determinístico que alimenta o módulo de IA.
 * Gera SUGESTÕES para o professor — nunca altera treinos automaticamente.
 * Um provedor LLM pode enriquecer o texto, mas a decisão continua com o professor.
 */
import { AiSuggestionType } from '../enums';
import { attendanceRate } from './frequency';
import { round } from './math';
import { estimateOneRepMax } from './training';

export interface SuggestionDraft {
  type: AiSuggestionType;
  title: string;
  content: string;
  payload: Record<string, unknown>;
}

export interface ExerciseSessionHistory {
  workoutExerciseId: string;
  exerciseName: string;
  targetReps: number | null;
  currentSuggestedLoadKg: number | null;
  /** Sessões mais recentes primeiro. */
  sessions: { date: string; sets: { loadKg: number; reps: number; rpe?: number | null }[] }[];
}

export function roundToStep(value: number, step = 0.5): number {
  return Math.round(value / step) * step;
}

/**
 * Dupla progressão: se nas duas últimas sessões todas as séries atingiram o
 * limite superior de repetições com RPE ≤ 8, sugerir +~5% de carga.
 */
export function suggestLoadProgression(history: ExerciseSessionHistory): SuggestionDraft | null {
  const { targetReps } = history;
  if (!targetReps || history.sessions.length < 2) return null;
  const lastTwo = history.sessions.slice(0, 2);
  const ready = lastTwo.every(
    (s) => s.sets.length > 0 && s.sets.every((set) => set.reps >= targetReps && (set.rpe ?? 7) <= 8),
  );
  if (!ready) return null;
  const currentLoad = Math.max(...lastTwo[0].sets.map((s) => s.loadKg));
  if (currentLoad <= 0) return null;
  const suggested = Math.max(currentLoad + 1, roundToStep(currentLoad * 1.05, 0.5));
  return {
    type: AiSuggestionType.LOAD_PROGRESSION,
    title: `Aumentar carga: ${history.exerciseName}`,
    content:
      `Nas duas últimas sessões todas as séries atingiram ${targetReps} repetições com esforço controlado. ` +
      `Sugestão: passar de ${currentLoad} kg para ${suggested} kg.`,
    payload: {
      workoutExerciseId: history.workoutExerciseId,
      fromKg: currentLoad,
      suggestedLoadKg: suggested,
    },
  };
}

/** Estagnação: melhor 1RM estimado não melhorou nas últimas 4 sessões (≥ 3 semanas). */
export function detectStagnation(history: ExerciseSessionHistory): SuggestionDraft | null {
  const sessions = history.sessions.slice(0, 4);
  if (sessions.length < 4) return null;
  const spanDays =
    (new Date(sessions[0].date).getTime() - new Date(sessions[sessions.length - 1].date).getTime()) / 86_400_000;
  if (spanDays < 21) return null;
  const best = sessions.map((s) => Math.max(0, ...s.sets.map((set) => estimateOneRepMax(set))));
  const oldest = best[best.length - 1];
  if (oldest <= 0 || best[0] > oldest) return null;
  return {
    type: AiSuggestionType.STAGNATION,
    title: `Estagnação em ${history.exerciseName}`,
    content:
      `Sem evolução de carga há ${Math.round(spanDays)} dias (1RM estimado ~${round(best[0], 1)} kg). ` +
      'Considere variar a técnica (ex.: rest pause, cluster set), ajustar o volume ou trocar a variação do exercício.',
    payload: { workoutExerciseId: history.workoutExerciseId, estimatedOneRmKg: best[0], spanDays: Math.round(spanDays) },
  };
}

/** Baixa frequência: < 50% do planejado nas últimas 2 semanas. */
export function detectLowFrequency(params: {
  studentName: string;
  sessionsLastTwoWeeks: number;
  plannedPerWeek: number;
  daysSinceLastWorkout: number | null;
}): SuggestionDraft | null {
  const rate = attendanceRate(params.sessionsLastTwoWeeks, params.plannedPerWeek, 2);
  if (rate >= 50) return null;
  const since =
    params.daysSinceLastWorkout === null
      ? 'ainda não registrou treinos'
      : `está há ${params.daysSinceLastWorkout} dias sem treinar`;
  return {
    type: AiSuggestionType.LOW_FREQUENCY,
    title: `Baixa frequência: ${params.studentName}`,
    content:
      `${params.studentName} cumpriu ${rate}% da frequência planejada nas últimas 2 semanas e ${since}. ` +
      'Sugestão: enviar uma mensagem de incentivo ou rever a divisão/horários do treino.',
    payload: { attendancePct: rate, daysSinceLastWorkout: params.daysSinceLastWorkout },
  };
}
