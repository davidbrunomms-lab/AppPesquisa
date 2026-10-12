import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { NotificationJobsService } from '../src/modules/jobs/application/notification-jobs.service';

/**
 * Fluxos ponta a ponta contra PostgreSQL real:
 * cadastro → vínculo → treino → execução → evolução → metas → agenda → chat → IA → LGPD.
 */
describe('PersonalPro API (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;

  const PASSWORD = 'SenhaForte123';
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const register = async (role: 'TRAINER' | 'STUDENT', email: string, extra: Record<string, unknown> = {}) => {
    const res = await http
      .post('/auth/register')
      .send({ name: `${role === 'TRAINER' ? 'Prof' : 'Aluno'} ${email.split('@')[0]}`, email, password: PASSWORD, role, acceptTerms: true, ...extra })
      .expect(201);
    return res.body as { accessToken: string; refreshToken: string; user: { id: string; trainerId: string; studentId: string }; linkError: string | null };
  };

  let trainer: Awaited<ReturnType<typeof register>>;
  let otherTrainer: Awaited<ReturnType<typeof register>>;
  let student: Awaited<ReturnType<typeof register>>;
  let workoutId: string;
  let benchWorkoutExerciseId: string;
  let benchExerciseId: string;
  let conversationId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Autenticação', () => {
    it('cadastra professor com período de teste e código de convite', async () => {
      trainer = await register('TRAINER', 'prof@e2e.com', { cref: '000001-G/SP' });
      otherTrainer = await register('TRAINER', 'outro@e2e.com');
      const me = await http.get('/trainers/me').set(auth(trainer.accessToken)).expect(200);
      expect(me.body.inviteCode).toHaveLength(6);
      const sub = await http.get('/subscriptions/me').set(auth(trainer.accessToken)).expect(200);
      expect(sub.body.subscription.status).toBe('TRIALING');
      expect(sub.body.entitled).toBe(true);
    });

    it('exige aceite dos termos (LGPD)', async () => {
      await http
        .post('/auth/register')
        .send({ name: 'Sem termos', email: 'x@e2e.com', password: PASSWORD, role: 'STUDENT', acceptTerms: false })
        .expect(400);
    });

    it('rejeita senha fraca', async () => {
      const res = await http
        .post('/auth/register')
        .send({ name: 'Fraca', email: 'fraca@e2e.com', password: 'somenteletras', role: 'STUDENT', acceptTerms: true })
        .expect(422);
      expect(res.body.code).toBe('WEAK_PASSWORD');
    });

    it('cadastra aluno com o código do professor (primeiro acesso)', async () => {
      const me = await http.get('/trainers/me').set(auth(trainer.accessToken));
      student = await register('STUDENT', 'aluno@e2e.com', { inviteCode: me.body.inviteCode });
      expect(student.linkError).toBeNull();
      expect(student.user.studentId).toBeTruthy();
    });

    it('login, refresh com rotação e detecção de reuso', async () => {
      const login = await http.post('/auth/login').send({ email: 'aluno@e2e.com', password: PASSWORD }).expect(200);
      expect(login.body.user.role).toBe('STUDENT');
      const refreshed = await http.post('/auth/refresh').send({ refreshToken: login.body.refreshToken }).expect(200);
      expect(refreshed.body.accessToken).toBeTruthy();
      // reutilizar o token antigo revoga todas as sessões
      await http.post('/auth/refresh').send({ refreshToken: login.body.refreshToken }).expect(401);
      await http.post('/auth/refresh').send({ refreshToken: refreshed.body.refreshToken }).expect(401);
    });

    it('login inválido não revela se o e-mail existe', async () => {
      const a = await http.post('/auth/login').send({ email: 'aluno@e2e.com', password: 'Errada123' }).expect(401);
      const b = await http.post('/auth/login').send({ email: 'naoexiste@e2e.com', password: 'Errada123' }).expect(401);
      expect(a.body.message).toEqual(b.body.message);
    });

    it('recuperação de senha com token de uso único', async () => {
      await http.post('/auth/forgot-password').send({ email: 'aluno@e2e.com' }).expect(204);
      const user = await prisma.user.findUniqueOrThrow({ where: { email: 'aluno@e2e.com' } });
      // Gera um token conhecido pelo serviço (o e-mail real vai para o MailPort)
      const { AuthService } = await import('../src/modules/auth/application/auth.service');
      const token = await app.get(AuthService).createPasswordToken(user.id, 1);
      await http.post('/auth/reset-password').send({ token, password: 'NovaSenha123' }).expect(204);
      await http.post('/auth/reset-password').send({ token, password: 'NovaSenha123' }).expect(422);
      const login = await http.post('/auth/login').send({ email: 'aluno@e2e.com', password: 'NovaSenha123' }).expect(200);
      student = { ...student, accessToken: login.body.accessToken };
    });
  });

  describe('Controle de acesso e isolamento entre professores', () => {
    it('professor vê apenas seus alunos', async () => {
      const mine = await http.get('/students').set(auth(trainer.accessToken)).expect(200);
      expect(mine.body).toHaveLength(1);
      const others = await http.get('/students').set(auth(otherTrainer.accessToken)).expect(200);
      expect(others.body).toHaveLength(0);
      await http.get(`/students/${student.user.studentId}`).set(auth(otherTrainer.accessToken)).expect(404);
      await http.get(`/progress/body?studentId=${student.user.studentId}`).set(auth(otherTrainer.accessToken)).expect(404);
    });

    it('aluno não acessa rotas de professor nem dados de outro aluno', async () => {
      await http.get('/students').set(auth(student.accessToken)).expect(403);
      await http.get('/admin/metrics').set(auth(student.accessToken)).expect(403);
      await http.get('/students/00000000-0000-0000-0000-000000000000').set(auth(student.accessToken)).expect(404);
    });

    it('rotas protegidas exigem token', async () => {
      await http.get('/dashboard/student').expect(401);
    });
  });

  describe('Cadastro manual e convites', () => {
    it('nome é obrigatório no cadastro manual', async () => {
      await http.post('/students').set(auth(trainer.accessToken)).send({ email: 'semnome@e2e.com' }).expect(400);
    });

    it('cadastra aluno manualmente', async () => {
      const res = await http
        .post('/students')
        .set(auth(trainer.accessToken))
        .send({ name: 'Maria Manual', email: 'maria@e2e.com', goal: 'WEIGHT_LOSS', level: 'BEGINNER', currentWeightKg: 70, heightCm: 165 })
        .expect(201);
      expect(res.body.student.initialWeightKg).toBe(70);
      expect(res.body.invited).toBe(false);
    });

    it('gera convite por WhatsApp com link e QR Code', async () => {
      const res = await http
        .post('/invites')
        .set(auth(trainer.accessToken))
        .send({ channel: 'WHATSAPP', phone: '(11) 98888-7777', name: 'Pedro' })
        .expect(201);
      expect(res.body.whatsappUrl).toContain('https://wa.me/5511988887777');
      const preview = await http.get(`/invites/${res.body.invite.code}/preview`).expect(200);
      expect(preview.body.trainer.name).toContain('Prof');
      const qr = await http.get(`/invites/${res.body.invite.code}/qrcode.png`).expect(200);
      expect(qr.headers['content-type']).toContain('image/png');
    });
  });

  describe('Treinos e execução', () => {
    it('lista a biblioteca de exercícios por grupo muscular', async () => {
      const res = await http.get('/exercises?muscleGroup=CHEST').set(auth(trainer.accessToken)).expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      benchExerciseId = res.body.find((e: { name: string }) => e.name === 'Supino reto com barra').id;
    });

    it('cria exercício personalizado visível só para o professor e seus alunos', async () => {
      const custom = await http
        .post('/exercises')
        .set(auth(trainer.accessToken))
        .send({ name: 'Supino com pausa', muscleGroup: 'CHEST', instructions: ['Pausa de 2s no peito'] })
        .expect(201);
      await http.get(`/exercises/${custom.body.id}`).set(auth(otherTrainer.accessToken)).expect(404);
      await http.get(`/exercises/${custom.body.id}`).set(auth(student.accessToken)).expect(200);
    });

    it('prescreve e atribui o Treino A', async () => {
      const res = await http
        .post('/workouts')
        .set(auth(trainer.accessToken))
        .send({
          name: 'Treino A',
          label: 'A',
          exercises: [{ exerciseId: benchExerciseId, sets: 3, reps: '10', suggestedLoadKg: 60, restSeconds: 90, technique: 'NORMAL' }],
        })
        .expect(201);
      workoutId = res.body.id;
      benchWorkoutExerciseId = res.body.exercises[0].id;
      await http.post(`/workouts/${workoutId}/assign`).set(auth(trainer.accessToken)).send({ studentId: student.user.studentId }).expect(201);
      // Outro professor não pode atribuir ao aluno
      await http.post(`/workouts/${workoutId}/assign`).set(auth(otherTrainer.accessToken)).send({ studentId: student.user.studentId }).expect(404);
      const today = await http.get('/workouts/today').set(auth(student.accessToken)).expect(200);
      expect(today.body.id).toBe(workoutId);
    });

    const runSession = async (load: number) => {
      const start = await http.post('/sessions').set(auth(student.accessToken)).send({ workoutId }).expect(201);
      const active = await http.get('/sessions/active').set(auth(student.accessToken)).expect(200);
      expect(active.body.id).toBe(start.body.id);
      let pr = false;
      for (let set = 1; set <= 3; set++) {
        const res = await http
          .post(`/sessions/${start.body.id}/sets`)
          .set(auth(student.accessToken))
          .send({ exerciseId: benchExerciseId, workoutExerciseId: benchWorkoutExerciseId, setNumber: set, loadKg: load, reps: 10, rpe: 7 })
          .expect(201);
        expect(res.body.restSeconds).toBe(90);
        pr = pr || res.body.isPersonalRecord;
      }
      const finish = await http.post(`/sessions/${start.body.id}/finish`).set(auth(student.accessToken)).send({ perceivedEffort: 7 }).expect(201);
      return { start: start.body, finish: finish.body, pr };
    };

    it('executa o treino: séries, descanso, volume, recorde e progressão', async () => {
      const first = await runSession(60);
      expect(first.start.exercises[0].previous).toBeNull();
      expect(first.finish.summary.totalVolumeKg).toBe(1800);
      expect(first.finish.summary.durationSeconds).toBeGreaterThanOrEqual(0);
      expect(first.pr).toBe(false);

      const second = await runSession(65);
      expect(second.start.exercises[0].previous.sets[0].loadKg).toBe(60); // carga anterior
      expect(second.pr).toBe(true);

      const prNotification = await prisma.notification.findFirst({
        where: { user: { email: 'aluno@e2e.com' }, type: 'PERSONAL_RECORD' },
      });
      expect(prNotification?.body).toContain('recorde no supino');

      const progress = await http.get(`/progress/exercises/${benchExerciseId}`).set(auth(student.accessToken)).expect(200);
      // Progressão agrupa por dia (melhor série do dia): as duas sessões foram hoje
      expect(progress.body.points.map((p: { loadKg: number }) => p.loadKg)).toEqual([65]);

      const stats = await http.get('/progress/stats').set(auth(student.accessToken)).expect(200);
      expect(stats.body.totalWorkouts).toBe(2);

      const milestone = await prisma.notification.findFirst({ where: { user: { email: 'aluno@e2e.com' }, type: 'MILESTONE' } });
      expect(milestone).toBeTruthy();
    });

    it('não permite registrar série em treino encerrado', async () => {
      const history = await http.get('/sessions').set(auth(student.accessToken)).expect(200);
      await http
        .post(`/sessions/${history.body.items[0].id}/sets`)
        .set(auth(student.accessToken))
        .send({ exerciseId: benchExerciseId, setNumber: 4, loadKg: 60, reps: 10 })
        .expect(409);
    });
  });

  describe('Avaliação física e metas', () => {
    let firstId: string;
    let secondId: string;

    it('registra avaliações calculando IMC e massa magra', async () => {
      const a = await http
        .post('/assessments')
        .set(auth(trainer.accessToken))
        .send({ studentId: student.user.studentId, weightKg: 92, heightCm: 180, bodyFatPct: 25, measurements: { waist: 100, rightArm: 35 }, assessedAt: '2026-08-01T10:00:00.000Z' })
        .expect(201);
      expect(a.body.bmi).toBe(28.4);
      expect(a.body.leanMassKg).toBe(69);
      firstId = a.body.id;

      await http
        .post('/goals')
        .set(auth(trainer.accessToken))
        .send({ studentId: student.user.studentId, type: 'BODY_WEIGHT', targetValue: 80 })
        .expect(201);

      const b = await http
        .post('/assessments')
        .set(auth(trainer.accessToken))
        .send({ studentId: student.user.studentId, weightKg: 84, bodyFatPct: 20, measurements: { waist: 92, rightArm: 36 } })
        .expect(201);
      secondId = b.body.id;
    });

    it('evolução de peso: 92 → 84 = −8 kg', async () => {
      const body = await http.get('/progress/body').set(auth(student.accessToken)).expect(200);
      expect(body.body.weight.delta).toBe(-8);
    });

    it('meta de peso com progresso percentual', async () => {
      const goals = await http.get('/goals').set(auth(student.accessToken)).expect(200);
      const weightGoal = goals.body.find((g: { type: string }) => g.type === 'BODY_WEIGHT');
      expect(weightGoal.title).toBe('Chegar a 80 kg');
      expect(weightGoal.progressPct).toBe(66.7);
    });

    it('meta de carga: supino 100 kg com atual 65 kg = 65%', async () => {
      const res = await http
        .post('/goals')
        .set(auth(trainer.accessToken))
        .send({ studentId: student.user.studentId, type: 'EXERCISE_LOAD', exerciseId: benchExerciseId, targetValue: 100, startValue: 0 })
        .expect(201);
      expect(res.body.currentValue).toBe(65);
      expect(res.body.progressPct).toBe(65);
    });

    it('compara antes x depois', async () => {
      const res = await http.get(`/assessments/compare?before=${firstId}&after=${secondId}`).set(auth(student.accessToken)).expect(200);
      expect(res.body.deltas.weightKg).toBe(-8);
      expect(res.body.deltas.measurements.waist).toBe(-8);
      expect(res.body.photos).toHaveLength(4);
    });

    it('envia foto de evolução', async () => {
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      const res = await http
        .post(`/assessments/${secondId}/photos?angle=FRONT`)
        .set(auth(trainer.accessToken))
        .attach('file', png, { filename: 'frente.png', contentType: 'image/png' })
        .expect(201);
      expect(res.body.photos[0].angle).toBe('FRONT');

      // Foto é dado sensível: só acessível por URL assinada e temporária
      const signed = new URL(res.body.photos[0].url);
      expect(signed.pathname).toMatch(/^\/files\/private\//);
      const ok = await http.get(`${signed.pathname}${signed.search}`).expect(200);
      expect(ok.headers['content-type']).toContain('image/png');
      await http.get(`${signed.pathname}?exp=${signed.searchParams.get('exp')}&sig=adulterada`).expect(404);
      const key = decodeURIComponent(signed.pathname.replace('/files/private/', ''));
      await http.get(`/uploads/${key}`).expect(404);
    });

    it('aluno não altera avaliação registrada pelo professor', async () => {
      await http.patch(`/assessments/${firstId}`).set(auth(student.accessToken)).send({ weightKg: 50 }).expect(403);
    });
  });

  describe('Agenda', () => {
    const at = (h: number) => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(h, 0, 0, 0);
      return d.toISOString();
    };

    it('professor cria horários; aluno reserva; professor confirma', async () => {
      const slots = await http
        .post('/appointments/slots')
        .set(auth(trainer.accessToken))
        .send({ startsAt: at(8), endsAt: at(10), durationMinutes: 60 })
        .expect(201);
      expect(slots.body).toHaveLength(2);

      const list = await http.get(`/appointments?from=${at(0)}&to=${at(23)}`).set(auth(student.accessToken)).expect(200);
      expect(list.body.filter((a: { status: string }) => a.status === 'AVAILABLE')).toHaveLength(2);

      const booked = await http.post(`/appointments/${slots.body[0].id}/book`).set(auth(student.accessToken)).send({}).expect(201);
      expect(booked.body.status).toBe('REQUESTED');
      await http.post(`/appointments/${slots.body[0].id}/book`).set(auth(student.accessToken)).send({}).expect(404);

      const confirmed = await http.post(`/appointments/${slots.body[0].id}/confirm`).set(auth(trainer.accessToken)).expect(201);
      expect(confirmed.body.status).toBe('CONFIRMED');
    });

    it('detecta conflito de horário', async () => {
      await http
        .post('/appointments')
        .set(auth(trainer.accessToken))
        .send({ studentId: student.user.studentId, startsAt: at(8), endsAt: at(9) })
        .expect(409);
    });

    it('lembrete "Seu treino começa em 1 hora."', async () => {
      const soon = new Date(Date.now() + 50 * 60_000);
      await http
        .post('/appointments')
        .set(auth(trainer.accessToken))
        .send({ studentId: student.user.studentId, startsAt: soon.toISOString(), endsAt: new Date(soon.getTime() + 3600_000).toISOString() })
        .expect(201);
      const sent = await app.get(NotificationJobsService).appointmentReminders();
      expect(sent).toBe(1);
      expect(await app.get(NotificationJobsService).appointmentReminders()).toBe(0);
    });
  });

  describe('Chat e anotações privadas', () => {
    it('aluno envia dúvida e professor responde', async () => {
      const q = await http.post('/conversations/question').set(auth(student.accessToken)).send({ content: 'Posso trocar o supino?' }).expect(201);
      expect(q.body.isQuestion).toBe(true);
      conversationId = q.body.trainerStudentId;

      const convs = await http.get('/conversations').set(auth(trainer.accessToken)).expect(200);
      const conv = convs.body.find((c: { id: string }) => c.id === conversationId);
      expect(conv.unreadCount).toBe(1);

      await http.post(`/conversations/${conversationId}/messages`).set(auth(trainer.accessToken)).send({ content: 'Pode sim!' }).expect(201);
      const doc = await http
        .post(`/conversations/${conversationId}/attachments`)
        .set(auth(trainer.accessToken))
        .attach('file', Buffer.from('treino em pdf'), { filename: 'treino.txt', contentType: 'text/plain' })
        .expect(201);
      expect(doc.body.type).toBe('FILE');
      expect(doc.body.attachmentUrl).toContain('/files/private/');
      const stored = await prisma.message.findUniqueOrThrow({ where: { id: doc.body.id } });
      expect(stored.attachmentUrl).toMatch(/^private:\/\//);
      await http.post(`/conversations/${conversationId}/read`).set(auth(trainer.accessToken)).expect(201);
      const msgs = await http.get(`/conversations/${conversationId}/messages`).set(auth(student.accessToken)).expect(200);
      expect(msgs.body).toHaveLength(3);
      await http.get(`/conversations/${conversationId}/messages`).set(auth(otherTrainer.accessToken)).expect(404);
    });

    it('anotações são privadas e criptografadas em repouso', async () => {
      const note = await http
        .post(`/students/${student.user.studentId}/notes`)
        .set(auth(trainer.accessToken))
        .send({ content: 'Aluno relatou desconforto no ombro durante supino.' })
        .expect(201);
      expect(note.body.content).toContain('ombro');
      const raw = await prisma.trainerNote.findUniqueOrThrow({ where: { id: note.body.id } });
      expect(raw.content.startsWith('enc:v1:')).toBe(true);
      await http.get(`/students/${student.user.studentId}/notes`).set(auth(student.accessToken)).expect(403);
      await http.get(`/students/${student.user.studentId}/notes`).set(auth(otherTrainer.accessToken)).expect(404);
    });
  });

  describe('IA e relatórios', () => {
    it('sugere progressão de carga e só aplica após aprovação do professor', async () => {
      const created = await http.post(`/ai/analyze?studentId=${student.user.studentId}`).set(auth(trainer.accessToken)).expect(201);
      const progression = created.body.find((s: { type: string }) => s.type === 'LOAD_PROGRESSION');
      expect(progression).toBeTruthy();

      let we = await prisma.workoutExercise.findUniqueOrThrow({ where: { id: benchWorkoutExerciseId } });
      expect(Number(we.suggestedLoadKg)).toBe(60); // nada alterado ainda

      // Não duplica a sugestão pendente
      const again = await http.post(`/ai/analyze?studentId=${student.user.studentId}`).set(auth(trainer.accessToken)).expect(201);
      expect(again.body.find((s: { type: string }) => s.type === 'LOAD_PROGRESSION')).toBeUndefined();

      await http.post(`/ai/suggestions/${progression.id}/approve`).set(auth(otherTrainer.accessToken)).expect(404);
      const approved = await http.post(`/ai/suggestions/${progression.id}/approve`).set(auth(trainer.accessToken)).expect(201);
      expect(approved.body.status).toBe('APPLIED');
      we = await prisma.workoutExercise.findUniqueOrThrow({ where: { id: benchWorkoutExerciseId } });
      expect(Number(we.suggestedLoadKg)).toBe(68.5);
    });

    it('gera relatório semanal', async () => {
      const res = await http
        .post('/reports/weekly')
        .set(auth(trainer.accessToken))
        .send({ studentId: student.user.studentId, weekStart: new Date().toISOString() })
        .expect(201);
      expect(res.body.summary).toMatch(/treinou 2 vezes nesta semana/);
      expect(res.body.summary).toMatch(/Frequência: \d+%/);
    });
  });

  describe('Dashboards e administração', () => {
    it('dashboard do professor', async () => {
      const res = await http.get('/dashboard/trainer').set(auth(trainer.accessToken)).expect(200);
      expect(res.body.activeStudents).toBe(2);
      expect(res.body.goalsNearCompletion).toBeDefined();
      expect(res.body.subscription.plan).toBe('Personal Pro');
    });

    it('dashboard do aluno', async () => {
      const res = await http.get('/dashboard/student').set(auth(student.accessToken)).expect(200);
      expect(res.body.todayWorkout.id).toBe(workoutId);
      expect(res.body.weight.evolution.delta).toBe(-8);
      expect(res.body.trainer.conversationId).toBe(conversationId);
      expect(res.body.totalWorkouts).toBe(2);
    });

    it('painel administrativo com métricas agregadas', async () => {
      const login = await http.post('/auth/login').send({ email: 'admin@personalpro.app', password: 'Admin12345' }).expect(200);
      const res = await http.get('/admin/metrics').set(auth(login.body.accessToken)).expect(200);
      expect(res.body.totals.trainers).toBe(2);
      expect(res.body.totals.students).toBeGreaterThanOrEqual(2);
      expect(res.body.series.signups).toHaveLength(30);
      await http.get('/admin/metrics').set(auth(trainer.accessToken)).expect(403);
    });

    it('limite de alunos do plano', async () => {
      const starter = await prisma.plan.findUniqueOrThrow({ where: { code: 'PERSONAL_STARTER' } });
      await prisma.plan.update({ where: { id: starter.id }, data: { maxStudents: 2 } });
      await prisma.subscription.update({ where: { trainerId: trainer.user.trainerId }, data: { planId: starter.id } });
      const res = await http
        .post('/students')
        .set(auth(trainer.accessToken))
        .send({ name: 'Terceiro', email: 'terceiro@e2e.com' })
        .expect(402);
      expect(res.body.code).toBe('PLAN_LIMIT');
    });
  });

  describe('LGPD', () => {
    it('exporta os dados do usuário', async () => {
      const res = await http.get('/account/export').set(auth(student.accessToken)).expect(200);
      expect(res.body.data.email).toBe('aluno@e2e.com');
      expect(res.body.data.passwordHash).toBeUndefined();
      expect(res.body.data.student.sessions).toHaveLength(2);
    });

    it('exclusão da conta do professor preserva o histórico dos alunos', async () => {
      const t = await register('TRAINER', 'saindo@e2e.com');
      const code = (await http.get('/trainers/me').set(auth(t.accessToken))).body.inviteCode;
      const s = await register('STUDENT', 'fica@e2e.com', { inviteCode: code });
      const custom = await http
        .post('/exercises')
        .set(auth(t.accessToken))
        .send({ name: 'Remada exclusiva', muscleGroup: 'BACK' })
        .expect(201);
      const w = await http
        .post('/workouts')
        .set(auth(t.accessToken))
        .send({ name: 'Treino X', exercises: [{ exerciseId: custom.body.id, sets: 1, reps: '10' }] })
        .expect(201);
      await http.post(`/workouts/${w.body.id}/assign`).set(auth(t.accessToken)).send({ studentId: s.user.studentId }).expect(201);
      const session = await http.post('/sessions').set(auth(s.accessToken)).send({ workoutId: w.body.id }).expect(201);
      await http
        .post(`/sessions/${session.body.id}/sets`)
        .set(auth(s.accessToken))
        .send({ exerciseId: custom.body.id, setNumber: 1, loadKg: 40, reps: 10 })
        .expect(201);
      await http.post(`/sessions/${session.body.id}/finish`).set(auth(s.accessToken)).send({}).expect(201);

      await http.delete('/account').set(auth(t.accessToken)).send({ password: PASSWORD }).expect(204);

      const history = await http.get('/sessions').set(auth(s.accessToken)).expect(200);
      expect(history.body.total).toBe(1);
      const progress = await http.get('/progress/exercises').set(auth(s.accessToken)).expect(200);
      expect(progress.body[0].name).toBe('Remada exclusiva');
      // O exercício arquivado não aparece na biblioteca de ninguém
      const library = await http.get('/exercises?search=exclusiva').set(auth(otherTrainer.accessToken)).expect(200);
      expect(library.body).toHaveLength(0);
    });

    it('exclui a conta com confirmação de senha', async () => {
      await http.delete('/account').set(auth(student.accessToken)).send({ password: 'errada' }).expect(401);
      await http.delete('/account').set(auth(student.accessToken)).send({ password: 'NovaSenha123' }).expect(204);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: student.user.id } });
      expect(user.deletedAt).not.toBeNull();
      expect(user.email).toContain('@personalpro.invalid');
      expect(await prisma.student.findUnique({ where: { id: student.user.studentId } })).toBeNull();
      await http.post('/auth/login').send({ email: 'aluno@e2e.com', password: 'NovaSenha123' }).expect(401);
    });
  });
});
