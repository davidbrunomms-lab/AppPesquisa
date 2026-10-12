import { formatDelta } from './body';
import { attendanceRate } from './frequency';
import { percentChange, round } from './math';

export interface WeeklyReportInput {
  studentName: string;
  weekStart: string;
  sessionsCount: number;
  plannedPerWeek: number;
  totalVolumeKg: number;
  previousWeekVolumeKg: number;
  totalDurationSeconds: number;
  weightStartKg: number | null;
  weightEndKg: number | null;
  /** Evolução de carga por exercício (melhor série da semana vs. anterior). */
  exercises: { name: string; previousBestKg: number | null; currentBestKg: number }[];
  personalRecords: number;
}

export interface WeeklyReportData {
  weekStart: string;
  sessionsCount: number;
  plannedPerWeek: number;
  attendancePct: number;
  totalVolumeKg: number;
  volumeChangePct: number | null;
  weightDeltaKg: number | null;
  totalDurationSeconds: number;
  personalRecords: number;
  highlights: { name: string; deltaKg: number }[];
}

export function buildWeeklyReport(input: WeeklyReportInput): { data: WeeklyReportData; summary: string } {
  const firstName = input.studentName.split(' ')[0];
  const attendancePct = attendanceRate(input.sessionsCount, input.plannedPerWeek);
  const volumeChangePct = input.previousWeekVolumeKg > 0
    ? percentChange(input.previousWeekVolumeKg, input.totalVolumeKg)
    : null;
  const weightDeltaKg =
    input.weightStartKg !== null && input.weightEndKg !== null
      ? round(input.weightEndKg - input.weightStartKg, 1)
      : null;
  const highlights = input.exercises
    .filter((e) => e.previousBestKg !== null && e.currentBestKg !== e.previousBestKg)
    .map((e) => ({ name: e.name, deltaKg: round(e.currentBestKg - (e.previousBestKg ?? 0), 1) }))
    .sort((a, b) => b.deltaKg - a.deltaKg)
    .slice(0, 3);

  const lines: string[] = [];
  const times = input.sessionsCount === 1 ? 'vez' : 'vezes';
  lines.push(`${firstName} treinou ${input.sessionsCount} ${times} nesta semana.`);
  if (volumeChangePct !== null) {
    lines.push(`Volume total: ${volumeChangePct > 0 ? '+' : ''}${volumeChangePct.toLocaleString('pt-BR')}%`);
  } else if (input.totalVolumeKg > 0) {
    lines.push(`Volume total: ${Math.round(input.totalVolumeKg).toLocaleString('pt-BR')} kg`);
  }
  if (weightDeltaKg !== null) lines.push(`Peso: ${formatDelta(weightDeltaKg)}`);
  for (const h of highlights) lines.push(`${h.name}: ${formatDelta(h.deltaKg)}`);
  if (input.personalRecords > 0) lines.push(`Recordes pessoais: ${input.personalRecords}`);
  lines.push(`Frequência: ${attendancePct}%.`);

  return {
    data: {
      weekStart: input.weekStart,
      sessionsCount: input.sessionsCount,
      plannedPerWeek: input.plannedPerWeek,
      attendancePct,
      totalVolumeKg: round(input.totalVolumeKg, 1),
      volumeChangePct,
      weightDeltaKg,
      totalDurationSeconds: input.totalDurationSeconds,
      personalRecords: input.personalRecords,
      highlights,
    },
    summary: lines.join('\n'),
  };
}
