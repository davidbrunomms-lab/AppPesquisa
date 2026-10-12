import { clamp, round } from './math';

export interface GoalProgressInput {
  startValue: number;
  currentValue: number;
  targetValue: number;
}

/**
 * Percentual de progresso de uma meta (0–100).
 *
 * - Metas de aumento (alvo > início — ex.: supino 100 kg, treinar 4x/semana):
 *   progresso = atual / alvo. Ex.: supino atual 85 kg, meta 100 kg → 85%.
 * - Metas de redução (alvo < início — ex.: peso 92 → 80 kg, gordura 22% → 15%):
 *   progresso = (início − atual) / (início − alvo). Ex.: 92 → 84 com meta 80 → 66,7%.
 */
export function goalProgress({ startValue, currentValue, targetValue }: GoalProgressInput): number {
  if (targetValue === startValue) return currentValue === targetValue ? 100 : 0;
  if (targetValue > startValue) {
    if (targetValue <= 0) return 0;
    return round(clamp((currentValue / targetValue) * 100, 0, 100), 1);
  }
  return round(clamp(((startValue - currentValue) / (startValue - targetValue)) * 100, 0, 100), 1);
}

export function isGoalAchieved(input: GoalProgressInput): boolean {
  return goalProgress(input) >= 100;
}

/** Metas "próximas de serem alcançadas" para o dashboard do professor. */
export const GOAL_NEAR_THRESHOLD = 80;

export function isGoalNear(input: GoalProgressInput, threshold = GOAL_NEAR_THRESHOLD): boolean {
  const progress = goalProgress(input);
  return progress >= threshold && progress < 100;
}
