import { round } from './math';

/** IMC = peso (kg) / altura (m)². */
export function calculateBmi(weightKg: number, heightCm: number): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const meters = heightCm / 100;
  return round(weightKg / (meters * meters), 1);
}

export type BmiCategory =
  | 'Abaixo do peso'
  | 'Peso normal'
  | 'Sobrepeso'
  | 'Obesidade grau I'
  | 'Obesidade grau II'
  | 'Obesidade grau III';

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'Abaixo do peso';
  if (bmi < 25) return 'Peso normal';
  if (bmi < 30) return 'Sobrepeso';
  if (bmi < 35) return 'Obesidade grau I';
  if (bmi < 40) return 'Obesidade grau II';
  return 'Obesidade grau III';
}

/** Massa magra = peso × (1 − %gordura). */
export function calculateLeanMass(weightKg: number, bodyFatPct: number): number | null {
  if (!weightKg || bodyFatPct === null || bodyFatPct === undefined) return null;
  if (bodyFatPct < 0 || bodyFatPct >= 100) return null;
  return round(weightKg * (1 - bodyFatPct / 100), 1);
}

export interface Evolution {
  initial: number;
  current: number;
  /** current − initial (ex.: −8 kg). */
  delta: number;
  deltaPct: number | null;
}

export function evolution(initial: number, current: number): Evolution {
  return {
    initial,
    current,
    delta: round(current - initial, 1),
    deltaPct: initial ? round(((current - initial) / initial) * 100, 1) : null,
  };
}

/** Formata a evolução como "−8 kg" / "+2,5 kg". */
export function formatDelta(delta: number, unit = 'kg'): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : '';
  const abs = Math.abs(round(delta, 1)).toLocaleString('pt-BR');
  return `${sign}${abs} ${unit}`.trim();
}
