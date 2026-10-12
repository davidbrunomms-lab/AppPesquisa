/**
 * Dados de demonstração — espelham apps/api/prisma/seed.ts (planos, biblioteca
 * de 52 exercícios, admin, professora Carla Mendes com João e Ana, treinos A/B/C,
 * histórico do João com progressão no supino 60 → 72 kg, avaliações 92 → 84 kg…),
 * com algumas adições para a demo ficar mais rica. Datas relativas a "agora".
 */
import { addDays, calculateBmi, calculateLeanMass, estimateCalories, PLAN_CATALOG, totalVolume } from '@personalpro/shared';
import { EXERCISE_LIBRARY } from '../../../api/prisma/data/exercises';
import { db, uuid, type DbStudent, type DbUser } from './db';
import { ai, goals, newStudent, newTrainer, notify, reports } from './services';

const DEMO_PASSWORD = 'Demo12345';
const iso = (d: Date) => d.toISOString();

function at(daysFromToday: number, hour: number, minute = 0) {
  const d = addDays(new Date(), daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function mkUser(data: Partial<DbUser> & { email: string; name: string; role: DbUser['role'] }, createdDaysAgo: number): DbUser {
  const u: DbUser = {
    id: uuid(),
    phone: null,
    avatarUrl: null,
    password: DEMO_PASSWORD,
    marketingOptIn: false,
    createdAt: iso(at(-createdDaysAgo, 10)),
    lastLoginAt: iso(at(-Math.min(createdDaysAgo, 2), 9)),
    deletedAt: null,
    ...data,
  };
  db().users.push(u);
  return u;
}

export function populateSeed() {
  const d = db();
  const now = new Date();

  // Planos
  for (const p of PLAN_CATALOG) {
    d.plans.push({
      id: uuid(),
      code: p.code,
      name: p.name,
      description: p.description,
      maxStudents: p.maxStudents,
      priceCents: p.priceCents,
      currency: 'BRL',
      interval: 'MONTHLY',
      active: true,
      createdAt: iso(at(-200, 9)),
      updatedAt: iso(at(-200, 9)),
    });
  }
  const plan = (code: string) => d.plans.find((p) => p.code === code)!;

  // Biblioteca global de exercícios
  for (const ex of EXERCISE_LIBRARY) {
    d.exercises.push({
      id: uuid(),
      trainerId: null,
      name: ex.name,
      description: ex.description,
      muscleGroup: ex.muscleGroup,
      equipment: ex.equipment ?? null,
      imageUrl: null,
      videoUrl: null,
      instructions: ex.instructions,
      commonMistakes: ex.commonMistakes,
      archivedAt: null,
      createdAt: iso(at(-200, 9)),
    });
  }
  const ex = (name: string) => {
    const e = d.exercises.find((x) => x.name === name);
    if (!e) throw new Error(`Exercício do seed não encontrado: ${name}`);
    return e.id;
  };

  // Admin
  mkUser({ email: 'admin@personalpro.app', name: 'Administrador', role: 'ADMIN', password: 'Admin12345' }, 180);

  // Academia
  const gym = { id: uuid(), name: 'Academia Central', city: 'São Paulo', state: 'SP', address: null };
  d.gyms.push(gym);

  // Professora Carla Mendes
  const carlaUser = mkUser({ email: 'professor@demo.personalpro.app', name: 'Carla Mendes', role: 'TRAINER', phone: '+5511999990000' }, 95);
  carlaUser.lastLoginAt = iso(now);
  const carla = newTrainer(carlaUser.id, {
    inviteCode: 'DEMO01',
    cref: '123456-G/SP',
    specialties: ['Hipertrofia', 'Emagrecimento', 'Reabilitação'],
    bio: 'Personal trainer há 8 anos, especialista em treinamento de força e composição corporal.',
    experienceYears: 8,
    socialLinks: { instagram: '@carla.personal' },
    gymIds: [gym.id],
    ratingAvg: 4.9,
    ratingCount: 2,
    availability: [1, 2, 3, 4, 5].flatMap((weekday) => [
      { id: uuid(), weekday, startTime: '06:00', endTime: '11:00' },
      { id: uuid(), weekday, startTime: '16:00', endTime: '21:00' },
    ]),
    createdAt: carlaUser.createdAt,
  });
  d.trainers.push(carla);
  const carlaSub = {
    id: uuid(),
    trainerId: carla.id,
    planId: plan('PERSONAL_PRO').id,
    status: 'ACTIVE' as const,
    provider: 'MANUAL',
    providerSubscriptionId: null,
    providerCustomerId: null,
    currentPeriodStart: iso(at(-1, 9)),
    currentPeriodEnd: iso(addDays(now, 30)),
    cancelAtPeriodEnd: false,
    createdAt: carlaUser.createdAt,
    updatedAt: iso(at(-1, 9)),
  };
  d.subscriptions.push(carlaSub);
  for (const days of [-81, -61, -31, -1]) {
    d.payments.push({
      id: uuid(),
      subscriptionId: carlaSub.id,
      provider: 'MANUAL',
      providerPaymentId: null,
      amountCents: days === -81 ? 0 : 9990,
      currency: 'BRL',
      status: 'PAID',
      paidAt: iso(at(days, 9)),
      createdAt: iso(at(days, 9)),
    });
  }
  d.payments = d.payments.filter((p) => p.amountCents > 0);

  // Outros professores (para o painel administrativo)
  const marinaUser = mkUser({ email: 'marina@demo.personalpro.app', name: 'Marina Lopes', role: 'TRAINER', phone: '+5521988887777' }, 45);
  const marina = newTrainer(marinaUser.id, { inviteCode: 'MARI42', cref: '654321-G/RJ', specialties: ['Funcional', 'Corrida'], experienceYears: 5, createdAt: marinaUser.createdAt });
  d.trainers.push(marina);
  const marinaSub = {
    id: uuid(),
    trainerId: marina.id,
    planId: plan('PERSONAL_STARTER').id,
    status: 'ACTIVE' as const,
    provider: 'MANUAL',
    providerSubscriptionId: null,
    providerCustomerId: null,
    currentPeriodStart: iso(at(-16, 9)),
    currentPeriodEnd: iso(addDays(now, 14)),
    cancelAtPeriodEnd: false,
    createdAt: marinaUser.createdAt,
    updatedAt: iso(at(-16, 9)),
  };
  d.subscriptions.push(marinaSub);
  d.payments.push({
    id: uuid(),
    subscriptionId: marinaSub.id,
    provider: 'MANUAL',
    providerPaymentId: null,
    amountCents: 4990,
    currency: 'BRL',
    status: 'PAID',
    paidAt: iso(at(-16, 9)),
    createdAt: iso(at(-16, 9)),
  });
  const rafaelUser = mkUser({ email: 'rafael@demo.personalpro.app', name: 'Rafael Souza', role: 'TRAINER' }, 6);
  const rafael = newTrainer(rafaelUser.id, { inviteCode: 'RAFA77', createdAt: rafaelUser.createdAt });
  d.trainers.push(rafael);
  d.subscriptions.push({
    id: uuid(),
    trainerId: rafael.id,
    planId: plan('PERSONAL_PRO').id,
    status: 'TRIALING',
    provider: 'MANUAL',
    providerSubscriptionId: null,
    providerCustomerId: null,
    currentPeriodStart: rafaelUser.createdAt,
    currentPeriodEnd: iso(addDays(new Date(rafaelUser.createdAt), 14)),
    cancelAtPeriodEnd: false,
    createdAt: rafaelUser.createdAt,
    updatedAt: rafaelUser.createdAt,
  });

  // Alunos
  const mkStudent = (email: string, name: string, extra: Partial<DbStudent>, trainerId: string, createdDaysAgo: number) => {
    const u = mkUser({ email, name, role: 'STUDENT' }, createdDaysAgo);
    const s = newStudent(u.id, { gymId: gym.id, ...extra, createdAt: u.createdAt });
    d.students.push(s);
    const link = { id: uuid(), trainerId, studentId: s.id, status: 'ACTIVE' as const, startedAt: iso(at(-createdDaysAgo, 10)), endedAt: null, createdAt: u.createdAt };
    d.links.push(link);
    return { user: u, student: s, link };
  };
  const joao = mkStudent(
    'joao@demo.personalpro.app',
    'João Pereira',
    { birthDate: '1990-05-12T00:00:00.000Z', sex: 'MALE', heightCm: 180, initialWeightKg: 92, currentWeightKg: 84, goal: 'HYPERTROPHY', level: 'INTERMEDIATE', weeklyFrequency: 4 },
    carla.id,
    60,
  );
  joao.user.phone = '+5511988881111';
  joao.user.lastLoginAt = iso(at(-1, 20));
  const ana = mkStudent(
    'ana@demo.personalpro.app',
    'Ana Ribeiro',
    { birthDate: '1996-09-30T00:00:00.000Z', sex: 'FEMALE', heightCm: 165, initialWeightKg: 70, currentWeightKg: 66.5, goal: 'WEIGHT_LOSS', level: 'BEGINNER', weeklyFrequency: 3 },
    carla.id,
    60,
  );
  const lucas = mkStudent(
    'lucas@demo.personalpro.app',
    'Lucas Martins',
    { sex: 'MALE', heightCm: 175, initialWeightKg: 78, currentWeightKg: 77, goal: 'CONDITIONING', level: 'BEGINNER', weeklyFrequency: 3 },
    marina.id,
    12,
  );
  void lucas;

  // Treinos A/B/C
  const mkWorkout = (
    name: string,
    label: string,
    items: { name: string; sets: number; reps: string; load: number; rest: number; technique?: string; groupKey?: string; notes?: string }[],
  ) => {
    const w = { id: uuid(), trainerId: carla.id, name, label, description: null, isTemplate: false, createdAt: iso(at(-58, 11)), updatedAt: iso(at(-58, 11)) };
    d.workouts.push(w);
    const wes = items.map((it, order) => ({
      id: uuid(),
      workoutId: w.id,
      exerciseId: ex(it.name),
      order,
      sets: it.sets,
      reps: it.reps,
      suggestedLoadKg: it.load,
      restSeconds: it.rest,
      technique: it.technique ?? 'NORMAL',
      groupKey: it.groupKey ?? null,
      notes: it.notes ?? null,
    }));
    d.workoutExercises.push(...wes);
    return { w, wes };
  };
  const A = mkWorkout('Treino A — Peito, ombro e tríceps', 'A', [
    { name: 'Supino reto com barra', sets: 4, reps: '8-10', load: 70, rest: 90, notes: 'Controle a descida (2 s).' },
    { name: 'Supino inclinado com halteres', sets: 3, reps: '10-12', load: 26, rest: 75 },
    { name: 'Elevação lateral', sets: 3, reps: '12-15', load: 10, rest: 60, technique: 'DROP_SET' },
    { name: 'Tríceps na polia (pulley)', sets: 3, reps: '12', load: 30, rest: 45, technique: 'BI_SET', groupKey: 'T' },
    { name: 'Tríceps francês', sets: 3, reps: '12', load: 14, rest: 60, technique: 'BI_SET', groupKey: 'T' },
  ]);
  const B = mkWorkout('Treino B — Costas e bíceps', 'B', [
    { name: 'Puxada frontal', sets: 4, reps: '10', load: 60, rest: 75 },
    { name: 'Remada baixa', sets: 3, reps: '10-12', load: 55, rest: 75 },
    { name: 'Rosca direta com barra', sets: 3, reps: '10', load: 30, rest: 60 },
  ]);
  const C = mkWorkout('Treino C — Pernas', 'C', [
    { name: 'Agachamento livre', sets: 4, reps: '8', load: 80, rest: 120, technique: 'PYRAMID' },
    { name: 'Leg press 45°', sets: 4, reps: '12', load: 200, rest: 90 },
    { name: 'Mesa flexora', sets: 3, reps: '12', load: 40, rest: 60 },
    { name: 'Panturrilha em pé', sets: 4, reps: '15', load: 60, rest: 45 },
  ]);
  [A, B, C].forEach(({ w }, i) => {
    d.studentWorkouts.push({ id: uuid(), studentId: joao.student.id, workoutId: w.id, weekdays: [[1, 4], [2, 5], [3]][i], order: i, active: true, startsAt: iso(at(-58, 11)), endsAt: null, createdAt: iso(at(-58, 11, i)) });
    d.studentWorkouts.push({ id: uuid(), studentId: ana.student.id, workoutId: w.id, weekdays: [], order: i, active: true, startsAt: iso(at(-58, 11)), endsAt: null, createdAt: iso(at(-58, 11, i)) });
  });

  // Histórico do João (4 semanas): A com supino 60 → 72 kg; B e C com cargas estáveis/progredindo
  const logSession = (
    workout: typeof A,
    daysAgo: number,
    loads: Record<number, number>,
    repsFor: (order: number, set: number) => number,
    prOrders: number[],
  ) => {
    const startedAt = at(daysAgo, 7);
    const sessionId = uuid();
    const sets = workout.wes.flatMap((we) =>
      Array.from({ length: we.sets }, (_, s) => ({
        id: uuid(),
        sessionId,
        exerciseId: we.exerciseId,
        workoutExerciseId: we.id,
        setNumber: s + 1,
        loadKg: loads[we.order] ?? we.suggestedLoadKg ?? 10,
        reps: repsFor(we.order, s),
        rpe: 7,
        notes: null,
        isPersonalRecord: prOrders.includes(we.order) && s === 0,
        completedAt: iso(new Date(startedAt.getTime() + (we.order * 4 + s) * 180_000)),
      })),
    );
    const duration = 3300 + Math.round(Math.random() * 600);
    d.sets.push(...sets);
    d.sessions.push({
      id: sessionId,
      studentId: joao.student.id,
      workoutId: workout.w.id,
      studentWorkoutId: d.studentWorkouts.find((sw) => sw.studentId === joao.student.id && sw.workoutId === workout.w.id)!.id,
      status: 'COMPLETED',
      startedAt: iso(startedAt),
      finishedAt: iso(new Date(startedAt.getTime() + duration * 1000)),
      durationSeconds: duration,
      totalVolumeKg: totalVolume(sets),
      estimatedCalories: estimateCalories({ durationSeconds: duration, bodyWeightKg: 84, perceivedEffort: 7 }),
      perceivedEffort: 7,
      notes: null,
      createdAt: iso(startedAt),
    });
  };
  [60, 65, 70, 72].forEach((load, week) => logSession(A, -28 + week * 7, { 0: load }, () => 10, week > 0 ? [0] : []));
  [55, 57.5, 60, 60].forEach((load, week) =>
    logSession(B, -26 + week * 7, { 0: load, 1: 50 + week * 2.5 }, (order) => [9, 10, 9][order] ?? 9, week > 0 && week < 3 ? [0] : []),
  );
  [70, 75, 75, 80].forEach((load, week) =>
    logSession(C, -24 + week * 7, { 0: load, 1: 180 + week * 10 }, (order) => [7, 11, 10, 13][order] ?? 10, week === 1 || week === 3 ? [0] : []),
  );

  // Avaliações do João: 92 → 84 kg
  [92, 89, 86, 84].forEach((w, i) => {
    const assessedAt = at(-60 + i * 20, 8);
    const bodyFatPct = 24 - i * 2;
    d.assessments.push({
      id: uuid(),
      studentId: joao.student.id,
      trainerId: carla.id,
      status: 'COMPLETED',
      scheduledFor: null,
      assessedAt: iso(assessedAt),
      weightKg: w,
      heightCm: 180,
      bmi: calculateBmi(w, 180),
      bodyFatPct,
      muscleMassKg: 36 + i * 0.5,
      leanMassKg: calculateLeanMass(w, bodyFatPct),
      visceralFat: 10 - i,
      notes: i === 3 ? 'Ótima evolução: −8 kg em 60 dias mantendo a massa muscular.' : null,
      measurements: {
        neck: 40 - i * 0.3,
        shoulders: 118,
        chest: 104,
        rightArm: round1(36 + i * 0.3),
        leftArm: round1(35.8 + i * 0.3),
        waist: 98 - i * 3,
        abdomen: 100 - i * 3,
        hip: 104 - i * 1.5,
        rightThigh: 60 - i * 0.5,
        leftThigh: 59.5 - i * 0.5,
        rightCalf: 39,
        leftCalf: 38.8,
      },
      photos: [],
      createdAt: iso(assessedAt),
    });
  });
  // Ana: 70 → 66,5 kg e avaliação agendada para daqui a 3 dias
  [70, 68.2, 66.5].forEach((w, i) => {
    const assessedAt = at(-58 + i * 25, 18);
    d.assessments.push({
      id: uuid(),
      studentId: ana.student.id,
      trainerId: carla.id,
      status: 'COMPLETED',
      scheduledFor: null,
      assessedAt: iso(assessedAt),
      weightKg: w,
      heightCm: 165,
      bmi: calculateBmi(w, 165),
      bodyFatPct: 31 - i * 1.5,
      muscleMassKg: 24 + i * 0.3,
      leanMassKg: calculateLeanMass(w, 31 - i * 1.5),
      visceralFat: null,
      notes: null,
      measurements: { neck: null, shoulders: null, chest: 92, rightArm: 29, leftArm: 28.8, waist: 78 - i * 2, abdomen: 84 - i * 2.5, hip: 102 - i, rightThigh: 58, leftThigh: 57.6, rightCalf: null, leftCalf: null },
      photos: [],
      createdAt: iso(assessedAt),
    });
  });
  d.assessments.push({
    id: uuid(),
    studentId: ana.student.id,
    trainerId: carla.id,
    status: 'SCHEDULED',
    scheduledFor: iso(at(3, 18)),
    assessedAt: null,
    weightKg: null,
    heightCm: null,
    bmi: null,
    bodyFatPct: null,
    muscleMassKg: null,
    leanMassKg: null,
    visceralFat: null,
    notes: 'Reavaliação trimestral',
    measurements: null,
    photos: [],
    createdAt: iso(at(-2, 10)),
  });

  // Metas
  const goal = (studentId: string, data: { type: string; title: string; unit: string; startValue: number; currentValue: number; targetValue: number; exerciseId?: string; deadlineDays?: number }) =>
    d.goals.push({
      id: uuid(),
      studentId,
      trainerId: carla.id,
      type: data.type,
      title: data.title,
      unit: data.unit,
      exerciseId: data.exerciseId ?? null,
      startValue: data.startValue,
      currentValue: data.currentValue,
      targetValue: data.targetValue,
      deadline: data.deadlineDays ? iso(at(data.deadlineDays, 12)) : null,
      status: 'ACTIVE',
      achievedAt: null,
      createdAt: iso(at(-55, 10)),
      updatedAt: iso(at(-55, 10)),
    });
  goal(joao.student.id, { type: 'BODY_WEIGHT', title: 'Chegar a 80 kg', unit: 'kg', startValue: 92, currentValue: 84, targetValue: 80, deadlineDays: 45 });
  goal(joao.student.id, { type: 'EXERCISE_LOAD', title: 'Supino reto 100 kg', unit: 'kg', exerciseId: ex('Supino reto com barra'), startValue: 60, currentValue: 72, targetValue: 100 });
  goal(joao.student.id, { type: 'WEEKLY_FREQUENCY', title: 'Treinar 4 vezes por semana', unit: 'treinos/semana', startValue: 0, currentValue: 1, targetValue: 4 });
  goal(ana.student.id, { type: 'BODY_WEIGHT', title: 'Chegar a 65 kg', unit: 'kg', startValue: 70, currentValue: 66.5, targetValue: 65, deadlineDays: 30 });
  goal(ana.student.id, { type: 'BODY_FAT', title: 'Reduzir gordura corporal para 26%', unit: '%', startValue: 31, currentValue: 28, targetValue: 26 });

  // Agenda: hoje (como no seed) + horários livres nos próximos dias
  const appt = (startsAt: Date, minutes: number, status: 'AVAILABLE' | 'REQUESTED' | 'CONFIRMED' | 'COMPLETED', studentId: string | null, extra: { location?: string; notes?: string } = {}) =>
    d.appointments.push({
      id: uuid(),
      trainerId: carla.id,
      studentId,
      requestedById: status === 'REQUESTED' && studentId ? d.students.find((s) => s.id === studentId)!.userId : null,
      status,
      startsAt: iso(startsAt),
      endsAt: iso(new Date(startsAt.getTime() + minutes * 60_000)),
      location: extra.location ?? 'Academia Central',
      notes: extra.notes ?? null,
      cancelReason: null,
      createdAt: iso(at(-3, 9)),
    });
  appt(at(0, 8), 60, 'CONFIRMED', joao.student.id);
  appt(at(0, 10), 60, 'AVAILABLE', null);
  appt(at(0, 14), 60, 'REQUESTED', ana.student.id, { notes: 'Posso focar em pernas?' });
  appt(at(1, 7), 60, 'AVAILABLE', null);
  appt(at(1, 18), 60, 'AVAILABLE', null);
  appt(at(1, 19), 60, 'AVAILABLE', null);
  appt(at(2, 8), 60, 'CONFIRMED', joao.student.id);
  appt(at(3, 17), 60, 'AVAILABLE', null);
  appt(at(-7, 8), 60, 'COMPLETED', joao.student.id);

  // Chat
  const msg = (from: DbUser, link: { id: string }, content: string, when: Date, opts: { isQuestion?: boolean; read?: boolean } = {}) =>
    d.messages.push({
      id: uuid(),
      trainerStudentId: link.id,
      senderId: from.id,
      type: 'TEXT',
      content,
      attachmentUrl: null,
      attachmentName: null,
      attachmentMime: null,
      isQuestion: opts.isQuestion ?? false,
      readAt: opts.read ? iso(new Date(when.getTime() + 600_000)) : null,
      createdAt: iso(when),
    });
  msg(carlaUser, joao.link, 'Bem-vindo, João! Montei seus treinos A, B e C. Qualquer dúvida é só chamar aqui.', at(-58, 11, 30), { read: true });
  msg(joao.user, joao.link, 'Valeu, Carla! Já vi a ficha. Começo amanhã cedo.', at(-58, 12), { read: true });
  msg(joao.user, joao.link, 'Bati 72 kg no supino hoje! 💪', at(-7, 8, 10), { read: true });
  msg(carlaUser, joao.link, 'Excelente! Vamos manter a progressão com calma.', at(-7, 9), { read: true });
  msg(joao.user, joao.link, 'Professora, senti o ombro no supino hoje.', at(-1, 19), { isQuestion: true });
  msg(carlaUser, joao.link, 'Obrigada por avisar! Vamos reduzir a carga na próxima sessão.', at(-1, 19, 20));
  msg(carlaUser, ana.link, 'Oi, Ana! Lembre-se da avaliação na semana que vem. 🙂', at(-2, 10), { read: true });
  msg(ana.user, ana.link, 'Combinado! Essa semana foi corrida, mas volto amanhã.', at(-2, 12));

  // Anotações privadas da professora
  d.notes.push(
    {
      id: uuid(),
      trainerId: carla.id,
      studentId: joao.student.id,
      content: 'Relatou desconforto no ombro direito durante o supino. Reforçar aquecimento de manguito e reduzir 5% da carga.',
      pinned: true,
      createdAt: iso(at(-1, 20)),
      updatedAt: iso(at(-1, 20)),
    },
    {
      id: uuid(),
      trainerId: carla.id,
      studentId: joao.student.id,
      content: 'Muito disciplinado com a dieta. Sugerir acompanhamento com nutricionista para a fase de hipertrofia.',
      pinned: false,
      createdAt: iso(at(-30, 18)),
      updatedAt: iso(at(-30, 18)),
    },
    {
      id: uuid(),
      trainerId: carla.id,
      studentId: ana.student.id,
      content: 'Prefere treinar à noite. Tem histórico de dor lombar leve — evitar terra convencional por enquanto.',
      pinned: true,
      createdAt: iso(at(-50, 18)),
      updatedAt: iso(at(-50, 18)),
    },
  );

  // Metas medidas automaticamente (frequência semanal etc.)
  goals.refreshForStudent(joao.student.id, { notify: false });
  goals.refreshForStudent(ana.student.id, { notify: false });

  // Relatórios semanais (duas últimas semanas) e sugestões da IA pendentes
  reports.generate(carla.id, joao.student.id, iso(addDays(now, -14)));
  reports.generate(carla.id, joao.student.id);
  reports.generate(carla.id, ana.student.id);
  ai.analyzeStudent(carla.id, joao.student.id, { notify: false, skipStagnation: true, at: iso(at(0, 6)) });
  ai.analyzeStudent(carla.id, ana.student.id, { notify: false, skipStagnation: true, at: iso(at(0, 6)) });

  // Notificações
  const n = (u: DbUser, type: string, title: string, body: string, when: Date, read = false, data: Record<string, string> = {}) => {
    const created = notify(u.id, { type, title, body, data }, iso(when));
    if (created && read) created.readAt = iso(new Date(when.getTime() + 3600_000));
  };
  n(carlaUser, 'SYSTEM', 'Bem-vinda ao PersonalPro', 'Seu plano Personal Pro está ativo. Convide alunos com o código DEMO01.', at(-90, 10), true);
  n(carlaUser, 'PERSONAL_RECORD', 'Recorde de aluno', 'João Pereira bateu o recorde no supino reto com barra: 72 kg.', at(-7, 7, 20), true, { studentId: joao.student.id });
  n(carlaUser, 'WEEKLY_REPORT', 'Relatórios semanais prontos', 'Os resumos da semana de 2 aluno(s) estão disponíveis.', at(0, 7));
  n(carlaUser, 'AI_SUGGESTION', 'Novas sugestões da IA', 'Há sugestões para seus alunos aguardando aprovação.', at(0, 6));
  n(carlaUser, 'MESSAGE', 'Dúvida de João Pereira', 'Professora, senti o ombro no supino hoje.', at(-1, 19), false, { conversationId: joao.link.id });
  n(carlaUser, 'APPOINTMENT', 'Solicitação de horário', 'Ana Ribeiro solicitou um treino hoje às 14:00.', at(-1, 9), false);
  n(joao.user, 'WORKOUT_UPDATED', 'Novo treino disponível', 'Seu professor atualizou seu treino.', at(-58, 11), true);
  n(joao.user, 'PERSONAL_RECORD', 'Novo recorde! 💪', 'Você bateu seu recorde no supino reto com barra: 72 kg.', at(-7, 7, 20), true);
  n(joao.user, 'ASSESSMENT', 'Nova avaliação física', 'Seu professor registrou uma nova avaliação física. Confira sua evolução!', at(0, 8, 30));
  n(joao.user, 'MESSAGE', 'Carla Mendes', 'Obrigada por avisar! Vamos reduzir a carga na próxima sessão.', at(-1, 19, 20), false, { conversationId: joao.link.id });
  n(joao.user, 'WORKOUT_REMINDER', 'Hora de treinar!', 'Seu treino de hoje já está disponível.', at(0, 6, 30));
  n(ana.user, 'ASSESSMENT', 'Avaliação física agendada', 'Sua avaliação física foi agendada para daqui a 3 dias às 18:00.', at(-2, 10));
  n(ana.user, 'INACTIVITY', 'Sentimos sua falta', 'Você está há alguns dias sem treinar. Que tal voltar hoje?', at(-1, 9));
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}
