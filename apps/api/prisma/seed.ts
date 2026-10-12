/**
 * Seed idempotente:
 *  - Planos SaaS (Starter/Pro/Unlimited)
 *  - Biblioteca global de exercícios
 *  - Administrador da plataforma
 *  - (fora de produção) professor e alunos de demonstração com histórico
 *
 * Uso: npm run db:seed   (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_DEMO=false opcionais)
 */
import { PrismaClient, SessionStatus, SubscriptionStatus } from '@prisma/client';
import { hash } from 'bcryptjs';
import { addDays, calculateBmi, PLAN_CATALOG } from '@personalpro/shared';
import { EXERCISE_LIBRARY } from './data/exercises';

const prisma = new PrismaClient();

async function seedPlans() {
  for (const plan of PLAN_CATALOG) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      create: plan,
      update: { name: plan.name, description: plan.description, maxStudents: plan.maxStudents, priceCents: plan.priceCents },
    });
  }
  console.log(`✔ ${PLAN_CATALOG.length} planos`);
}

async function seedExercises() {
  for (const ex of EXERCISE_LIBRARY) {
    const existing = await prisma.exercise.findFirst({ where: { name: ex.name, trainerId: null } });
    if (existing) await prisma.exercise.update({ where: { id: existing.id }, data: ex });
    else await prisma.exercise.create({ data: ex });
  }
  console.log(`✔ ${EXERCISE_LIBRARY.length} exercícios na biblioteca`);
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@personalpro.app';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345';
  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: 'Administrador',
      role: 'ADMIN',
      passwordHash: await hash(password, 12),
      termsAcceptedAt: new Date(),
      emailVerifiedAt: new Date(),
    },
    update: {},
  });
  console.log(`✔ admin: ${email}`);
}

const ex = async (name: string) => (await prisma.exercise.findFirstOrThrow({ where: { name, trainerId: null } })).id;

async function seedDemo() {
  const password = await hash('Demo12345', 12);
  if (await prisma.user.findUnique({ where: { email: 'professor@demo.personalpro.app' } })) {
    console.log('• dados demo já existem');
    return;
  }
  const pro = await prisma.plan.findUniqueOrThrow({ where: { code: 'PERSONAL_PRO' } });
  const trainerUser = await prisma.user.create({
    data: {
      email: 'professor@demo.personalpro.app',
      name: 'Carla Mendes',
      phone: '+5511999990000',
      role: 'TRAINER',
      passwordHash: password,
      termsAcceptedAt: new Date(),
      trainer: {
        create: {
          inviteCode: 'DEMO01',
          cref: '123456-G/SP',
          specialties: ['Hipertrofia', 'Emagrecimento', 'Reabilitação'],
          bio: 'Personal trainer há 8 anos, especialista em treinamento de força e composição corporal.',
          experienceYears: 8,
          socialLinks: { instagram: '@carla.personal' },
          availability: {
            create: [1, 2, 3, 4, 5].flatMap((weekday) => [
              { weekday, startTime: '06:00', endTime: '11:00' },
              { weekday, startTime: '16:00', endTime: '21:00' },
            ]),
          },
        },
      },
    },
    include: { trainer: true },
  });
  const trainerId = trainerUser.trainer!.id;
  await prisma.subscription.create({
    data: { trainerId, planId: pro.id, status: SubscriptionStatus.ACTIVE, currentPeriodEnd: addDays(new Date(), 30) },
  });
  const gym = await prisma.gym.upsert({
    where: { name_city: { name: 'Academia Central', city: 'São Paulo' } },
    create: { name: 'Academia Central', city: 'São Paulo', state: 'SP' },
    update: {},
  });
  await prisma.trainerGym.create({ data: { trainerId, gymId: gym.id } });

  const mkStudent = (email: string, name: string, extra: object) =>
    prisma.user.create({
      data: {
        email,
        name,
        role: 'STUDENT',
        passwordHash: password,
        termsAcceptedAt: new Date(),
        student: {
          create: {
            gymId: gym.id,
            ...extra,
            trainers: { create: { trainerId, startedAt: addDays(new Date(), -60) } },
          },
        },
      },
      include: { student: true },
    });

  const joao = await mkStudent('joao@demo.personalpro.app', 'João Pereira', {
    birthDate: new Date('1990-05-12'),
    sex: 'MALE',
    heightCm: 180,
    initialWeightKg: 92,
    currentWeightKg: 84,
    goal: 'HYPERTROPHY',
    level: 'INTERMEDIATE',
    weeklyFrequency: 4,
  });
  const ana = await mkStudent('ana@demo.personalpro.app', 'Ana Ribeiro', {
    birthDate: new Date('1996-09-30'),
    sex: 'FEMALE',
    heightCm: 165,
    initialWeightKg: 70,
    currentWeightKg: 66.5,
    goal: 'WEIGHT_LOSS',
    level: 'BEGINNER',
    weeklyFrequency: 3,
  });

  const workoutA = await prisma.workout.create({
    data: {
      trainerId,
      name: 'Treino A — Peito, ombro e tríceps',
      label: 'A',
      exercises: {
        create: [
          { exerciseId: await ex('Supino reto com barra'), order: 0, sets: 4, reps: '8-10', suggestedLoadKg: 70, restSeconds: 90 },
          { exerciseId: await ex('Supino inclinado com halteres'), order: 1, sets: 3, reps: '10-12', suggestedLoadKg: 26, restSeconds: 75 },
          { exerciseId: await ex('Elevação lateral'), order: 2, sets: 3, reps: '12-15', suggestedLoadKg: 10, restSeconds: 60, technique: 'DROP_SET' },
          { exerciseId: await ex('Tríceps na polia (pulley)'), order: 3, sets: 3, reps: '12', suggestedLoadKg: 30, restSeconds: 45, technique: 'BI_SET', groupKey: 'T' },
          { exerciseId: await ex('Tríceps francês'), order: 4, sets: 3, reps: '12', suggestedLoadKg: 14, restSeconds: 60, technique: 'BI_SET', groupKey: 'T' },
        ],
      },
    },
    include: { exercises: true },
  });
  const workoutB = await prisma.workout.create({
    data: {
      trainerId,
      name: 'Treino B — Costas e bíceps',
      label: 'B',
      exercises: {
        create: [
          { exerciseId: await ex('Puxada frontal'), order: 0, sets: 4, reps: '10', suggestedLoadKg: 60, restSeconds: 75 },
          { exerciseId: await ex('Remada baixa'), order: 1, sets: 3, reps: '10-12', suggestedLoadKg: 55, restSeconds: 75 },
          { exerciseId: await ex('Rosca direta com barra'), order: 2, sets: 3, reps: '10', suggestedLoadKg: 30, restSeconds: 60 },
        ],
      },
    },
  });
  const workoutC = await prisma.workout.create({
    data: {
      trainerId,
      name: 'Treino C — Pernas',
      label: 'C',
      exercises: {
        create: [
          { exerciseId: await ex('Agachamento livre'), order: 0, sets: 4, reps: '8', suggestedLoadKg: 80, restSeconds: 120, technique: 'PYRAMID' },
          { exerciseId: await ex('Leg press 45°'), order: 1, sets: 4, reps: '12', suggestedLoadKg: 200, restSeconds: 90 },
          { exerciseId: await ex('Mesa flexora'), order: 2, sets: 3, reps: '12', suggestedLoadKg: 40, restSeconds: 60 },
          { exerciseId: await ex('Panturrilha em pé'), order: 3, sets: 4, reps: '15', suggestedLoadKg: 60, restSeconds: 45 },
        ],
      },
    },
  });
  for (const [i, w] of [workoutA, workoutB, workoutC].entries()) {
    await prisma.studentWorkout.create({ data: { studentId: joao.student!.id, workoutId: w.id, order: i, weekdays: [[1, 4], [2, 5], [3]][i] } });
    await prisma.studentWorkout.create({ data: { studentId: ana.student!.id, workoutId: w.id, order: i } });
  }

  // Histórico do João: 4 semanas de Treino A com progressão no supino (60 → 72 kg)
  const supinoLoads = [60, 65, 70, 72];
  for (const [week, load] of supinoLoads.entries()) {
    const startedAt = addDays(new Date(), -28 + week * 7);
    startedAt.setHours(7, 0, 0, 0);
    const sets = workoutA.exercises.flatMap((we) =>
      Array.from({ length: we.sets }, (_, s) => ({
        exerciseId: we.exerciseId,
        workoutExerciseId: we.id,
        setNumber: s + 1,
        loadKg: we.order === 0 ? load : Number(we.suggestedLoadKg ?? 10),
        reps: 10,
        rpe: 7,
        isPersonalRecord: we.order === 0 && week > 0 && s === 0,
        completedAt: new Date(startedAt.getTime() + (we.order * 4 + s) * 180_000),
      })),
    );
    const volume = sets.reduce((acc, s) => acc + s.loadKg * s.reps, 0);
    await prisma.workoutSession.create({
      data: {
        studentId: joao.student!.id,
        workoutId: workoutA.id,
        status: SessionStatus.COMPLETED,
        startedAt,
        finishedAt: new Date(startedAt.getTime() + 3600_000),
        durationSeconds: 3600,
        totalVolumeKg: volume,
        estimatedCalories: 420,
        perceivedEffort: 7,
        sets: { create: sets },
      },
    });
  }

  // Avaliações do João: 92 → 84 kg
  for (const [i, w] of [92, 89, 86, 84].entries()) {
    const assessedAt = addDays(new Date(), -60 + i * 20);
    await prisma.bodyAssessment.create({
      data: {
        studentId: joao.student!.id,
        trainerId,
        assessedAt,
        weightKg: w,
        heightCm: 180,
        bmi: calculateBmi(w, 180),
        bodyFatPct: 24 - i * 2,
        muscleMassKg: 36 + i * 0.5,
        measurements: { create: { waist: 98 - i * 3, abdomen: 100 - i * 3, chest: 104, rightArm: 36 + i * 0.3, leftArm: 35.8 + i * 0.3 } },
      },
    });
  }
  await prisma.bodyAssessment.create({
    data: { studentId: ana.student!.id, trainerId, status: 'SCHEDULED', scheduledFor: addDays(new Date(), 3) },
  });

  await prisma.studentGoal.createMany({
    data: [
      { studentId: joao.student!.id, trainerId, type: 'BODY_WEIGHT', title: 'Chegar a 80 kg', unit: 'kg', startValue: 92, currentValue: 84, targetValue: 80 },
      { studentId: joao.student!.id, trainerId, type: 'EXERCISE_LOAD', title: 'Supino reto 100 kg', unit: 'kg', exerciseId: await ex('Supino reto com barra'), startValue: 60, currentValue: 72, targetValue: 100 },
      { studentId: joao.student!.id, trainerId, type: 'WEEKLY_FREQUENCY', title: 'Treinar 4 vezes por semana', unit: 'treinos/semana', startValue: 0, currentValue: 1, targetValue: 4 },
    ],
  });

  const today = new Date();
  const at = (h: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate(), h);
  await prisma.appointment.createMany({
    data: [
      { trainerId, studentId: joao.student!.id, startsAt: at(8), endsAt: at(9), status: 'CONFIRMED' },
      { trainerId, startsAt: at(10), endsAt: at(11), status: 'AVAILABLE' },
      { trainerId, studentId: ana.student!.id, startsAt: at(14), endsAt: at(15), status: 'REQUESTED' },
    ],
  });

  const link = await prisma.trainerStudent.findFirstOrThrow({ where: { trainerId, studentId: joao.student!.id } });
  await prisma.message.createMany({
    data: [
      { trainerStudentId: link.id, senderId: joao.id, content: 'Professora, senti o ombro no supino hoje.', isQuestion: true, createdAt: addDays(new Date(), -1) },
      { trainerStudentId: link.id, senderId: trainerUser.id, content: 'Obrigada por avisar! Vamos reduzir a carga na próxima sessão.', createdAt: addDays(new Date(), -1) },
    ],
  });
  console.log('✔ demo: professor@demo.personalpro.app / joao@demo.personalpro.app / ana@demo.personalpro.app (senha Demo12345, código DEMO01)');
}

async function main() {
  await seedPlans();
  await seedExercises();
  await seedAdmin();
  if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO !== 'false') await seedDemo();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
