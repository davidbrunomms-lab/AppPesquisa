import { calculateBmi, evolution, formatDelta } from './body';
import { goalProgress, isGoalNear } from './goals';
import { estimateCalories, isPersonalRecord, loadProgression, parseTargetReps, totalVolume } from './training';
import { attendanceRate, dayStreak, trainingStats, weeklyFrequencySeries } from './frequency';
import { buildWeeklyReport } from './weekly-report';
import { detectLowFrequency, detectStagnation, suggestLoadProgression } from './ai-rules';
import { canAddStudent } from './plans';

describe('body', () => {
  it('calcula IMC', () => expect(calculateBmi(84, 180)).toBe(25.9));
  it('evolução de peso 92 → 84 = −8 kg', () => {
    expect(evolution(92, 84).delta).toBe(-8);
    expect(formatDelta(-8)).toBe('-8 kg');
  });
});

describe('goals', () => {
  it('meta de aumento: supino 85/100 = 85%', () =>
    expect(goalProgress({ startValue: 70, currentValue: 85, targetValue: 100 })).toBe(85));
  it('meta de redução: peso 92 → 84 com alvo 80', () =>
    expect(goalProgress({ startValue: 92, currentValue: 84, targetValue: 80 })).toBe(66.7));
  it('limita entre 0 e 100', () => {
    expect(goalProgress({ startValue: 92, currentValue: 95, targetValue: 80 })).toBe(0);
    expect(goalProgress({ startValue: 92, currentValue: 78, targetValue: 80 })).toBe(100);
  });
  it('meta próxima (≥80%)', () => expect(isGoalNear({ startValue: 0, currentValue: 85, targetValue: 100 })).toBe(true));
});

describe('training', () => {
  it('volume total', () => expect(totalVolume([{ loadKg: 60, reps: 10 }, { loadKg: 65, reps: 8 }])).toBe(1120));
  it('recorde pessoal', () => {
    expect(isPersonalRecord({ loadKg: 72, reps: 6 }, { loadKg: 70, reps: 8 })).toBe(true);
    expect(isPersonalRecord({ loadKg: 70, reps: 9 }, { loadKg: 70, reps: 8 })).toBe(true);
    expect(isPersonalRecord({ loadKg: 70, reps: 8 }, { loadKg: 70, reps: 8 })).toBe(false);
    expect(isPersonalRecord({ loadKg: 70, reps: 8 }, null)).toBe(false);
  });
  it('calorias por MET', () => expect(estimateCalories({ durationSeconds: 3600, bodyWeightKg: 80 })).toBe(400));
  it('progressão de carga usa a melhor série do dia', () => {
    const points = loadProgression([
      { completedAt: '2026-09-01T10:00:00Z', loadKg: 60, reps: 10 },
      { completedAt: '2026-09-01T10:05:00Z', loadKg: 55, reps: 12 },
      { completedAt: '2026-09-08T10:00:00Z', loadKg: 65, reps: 8 },
    ]);
    expect(points).toEqual([
      { date: '2026-09-01', loadKg: 60, reps: 10 },
      { date: '2026-09-08', loadKg: 65, reps: 8 },
    ]);
  });
  it('interpreta repetições alvo', () => {
    expect(parseTargetReps('8-12')).toBe(12);
    expect(parseTargetReps('falha')).toBeNull();
  });
});

describe('frequency', () => {
  const ref = new Date(2026, 9, 14, 12); // quarta 14/10/2026
  const sessions = [
    { startedAt: new Date(2026, 9, 12, 8), durationSeconds: 3600 },
    { startedAt: new Date(2026, 9, 13, 8), durationSeconds: 3000 },
    { startedAt: new Date(2026, 9, 14, 8), durationSeconds: 3300 },
    { startedAt: new Date(2026, 9, 5, 8), durationSeconds: 3300 },
  ];
  it('estatísticas', () => {
    const stats = trainingStats(sessions, ref);
    expect(stats.weekCount).toBe(3);
    expect(stats.monthCount).toBe(4);
    expect(stats.averageDurationSeconds).toBe(3300);
    expect(stats.currentStreakDays).toBe(3);
  });
  it('série semanal', () => {
    const series = weeklyFrequencySeries(sessions, 2, ref);
    expect(series.map((s) => s.count)).toEqual([1, 3]);
  });
  it('taxa de frequência', () => expect(attendanceRate(3, 4)).toBe(75));
  it('streak vazio', () => expect(dayStreak([], ref)).toBe(0));
});

describe('weekly report', () => {
  it('gera o resumo no formato esperado', () => {
    const { summary, data } = buildWeeklyReport({
      studentName: 'João Silva',
      weekStart: '2026-10-05',
      sessionsCount: 4,
      plannedPerWeek: 4,
      totalVolumeKg: 11200,
      previousWeekVolumeKg: 10000,
      totalDurationSeconds: 14400,
      weightStartKg: 85,
      weightEndKg: 84.2,
      exercises: [{ name: 'Supino', previousBestKg: 70, currentBestKg: 75 }],
      personalRecords: 1,
    });
    expect(summary).toContain('João treinou 4 vezes nesta semana.');
    expect(summary).toContain('Volume total: +12%');
    expect(summary).toContain('Peso: -0,8 kg');
    expect(summary).toContain('Supino: +5 kg');
    expect(summary).toContain('Frequência: 100%.');
    expect(data.attendancePct).toBe(100);
  });
});

describe('ai rules', () => {
  const history = (sets: number[][], dates: string[]) => ({
    workoutExerciseId: 'we1',
    exerciseName: 'Supino reto',
    targetReps: 10,
    currentSuggestedLoadKg: 60,
    sessions: sets.map((loads, i) => ({ date: dates[i], sets: loads.map((l) => ({ loadKg: l, reps: 10, rpe: 7 })) })),
  });

  it('sugere progressão quando o aluno bate as repetições alvo', () => {
    const s = suggestLoadProgression(history([[60, 60, 60], [60, 60, 60]], ['2026-10-10', '2026-10-07']));
    expect(s?.payload.suggestedLoadKg).toBe(63);
  });
  it('detecta estagnação', () => {
    const s = detectStagnation(
      history([[60], [60], [60], [60]], ['2026-10-10', '2026-10-01', '2026-09-24', '2026-09-15']),
    );
    expect(s?.type).toBe('STAGNATION');
  });
  it('detecta baixa frequência', () => {
    expect(detectLowFrequency({ studentName: 'Ana', sessionsLastTwoWeeks: 1, plannedPerWeek: 3, daysSinceLastWorkout: 9 })).not.toBeNull();
    expect(detectLowFrequency({ studentName: 'Ana', sessionsLastTwoWeeks: 5, plannedPerWeek: 3, daysSinceLastWorkout: 1 })).toBeNull();
  });
});

describe('plans', () => {
  it('limite de alunos', () => {
    expect(canAddStudent(9, 10)).toBe(true);
    expect(canAddStudent(10, 10)).toBe(false);
    expect(canAddStudent(1000, null)).toBe(true);
  });
});
