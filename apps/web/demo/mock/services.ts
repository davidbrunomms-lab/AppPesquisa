/**
 * Regras de negócio da demo, espelhando apps/api/src/modules/* (mesmos status,
 * códigos e mensagens de erro). As regras puras vêm de @personalpro/shared.
 */
import {
  addDays,
  attendanceRate,
  bestSet,
  BODY_MEASUREMENT_KEYS,
  buildWeeklyReport,
  calculateBmi,
  calculateLeanMass,
  canAddStudent,
  daysSinceLastWorkout,
  detectLowFrequency,
  detectStagnation,
  endOfDay,
  estimateCalories,
  estimateOneRepMax,
  evolution,
  goalProgress,
  INACTIVITY_THRESHOLD_DAYS,
  isGoalNear,
  isPersonalRecord,
  isWorkoutMilestone,
  loadProgression,
  parseTargetReps,
  round,
  startOfDay,
  startOfMonth,
  startOfWeek,
  suggestLoadProgression,
  timeToMinutes,
  toDateKey,
  totalVolume,
  trainingStats,
  TRIAL_DAYS,
  weeklyFrequencySeries,
  type ExerciseSessionHistory,
  type SuggestionDraft,
} from '@personalpro/shared';
import {
  db,
  nowIso,
  uuid,
  type DbAppointment,
  type DbAssessment,
  type DbExercise,
  type DbGoal,
  type DbLink,
  type DbMessage,
  type DbNotification,
  type DbStudent,
  type DbTrainer,
  type DbUser,
  type DbWorkout,
} from './db';
import { badRequest, conflict, domain, forbidden, HttpError, notFound, planLimit, unauthorized, type AuthUser } from './http';

const iso = (d: Date) => d.toISOString();
const t = (s: string | null | undefined) => (s ? new Date(s).getTime() : 0);
const byId = <T extends { id: string }>(list: T[], id: string | null | undefined) => (id ? list.find((x) => x.id === id) : undefined);

// ---------------------------------------------------------------------------
// Realtime (chat) — o shim de socket.io assina estes eventos
// ---------------------------------------------------------------------------

type RealtimeEvent =
  | { type: 'message'; conversationId: string; payload: unknown }
  | { type: 'read'; conversationId: string; payload: { conversationId: string; readerId: string; at: string } };
const realtimeListeners = new Set<(e: RealtimeEvent) => void>();
export function onRealtime(fn: (e: RealtimeEvent) => void) {
  realtimeListeners.add(fn);
  return () => {
    realtimeListeners.delete(fn);
  };
}
export function publishRealtime(e: RealtimeEvent) {
  realtimeListeners.forEach((l) => l(e));
}

// ---------------------------------------------------------------------------
// Utilidades de domínio
// ---------------------------------------------------------------------------

export const userOf = (id: string) => byId(db().users, id)!;
export const trainerById = (id: string) => byId(db().trainers, id);
export const studentById = (id: string) => byId(db().students, id);
export const trainerUser = (trainerId: string) => userOf(trainerById(trainerId)!.userId);
export const studentUser = (studentId: string) => userOf(studentById(studentId)!.userId);
export const findLink = (trainerId: string, studentId: string) =>
  db().links.find((l) => l.trainerId === trainerId && l.studentId === studentId);

export function authUserFor(user: DbUser): AuthUser {
  return {
    userId: user.id,
    role: user.role,
    trainerId: db().trainers.find((x) => x.userId === user.id)?.id ?? null,
    studentId: db().students.find((x) => x.userId === user.id)?.id ?? null,
  };
}

export function normalizeEmail(email: string) {
  return String(email ?? '').trim().toLowerCase();
}

export function assertStrongPassword(password: string) {
  if (!password || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw domain('A senha deve ter ao menos 8 caracteres, com letras e números', 'WEAK_PASSWORD');
  }
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function readableCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}
export const randomToken = (n = 32) => {
  let s = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

const fmtSP = (d: Date) =>
  d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// ---------------------------------------------------------------------------
// Acesso (AccessPolicyService)
// ---------------------------------------------------------------------------

export const access = {
  assertTrainerCanAccessStudent(trainerId: string, studentId: string): DbLink {
    const link = findLink(trainerId, studentId);
    if (!link || link.status === 'INACTIVE') throw notFound('Aluno');
    return link;
  },
  assertTrainerHasLink(trainerId: string, studentId: string): DbLink {
    const link = findLink(trainerId, studentId);
    if (!link) throw notFound('Aluno');
    return link;
  },
  resolveStudentId(user: AuthUser, studentId?: string | null): string {
    if (user.role === 'STUDENT') {
      if (!user.studentId) throw forbidden('Perfil de aluno não encontrado');
      if (studentId && studentId !== user.studentId) throw notFound('Aluno');
      return user.studentId;
    }
    if (user.role === 'TRAINER') {
      if (!studentId) throw forbidden('Informe o aluno (studentId)');
      this.assertTrainerCanAccessStudent(this.requireTrainer(user), studentId);
      return studentId;
    }
    throw forbidden();
  },
  requireTrainer(user: AuthUser): string {
    if (user.role !== 'TRAINER' || !user.trainerId) throw forbidden('Apenas professores');
    return user.trainerId;
  },
  requireStudent(user: AuthUser): string {
    if (user.role !== 'STUDENT' || !user.studentId) throw forbidden('Apenas alunos');
    return user.studentId;
  },
  primaryLinkForStudent(studentId: string): DbLink | null {
    return (
      db()
        .links.filter((l) => l.studentId === studentId && l.status === 'ACTIVE')
        .sort((a, b) => t(b.startedAt) - t(a.startedAt))[0] ?? null
    );
  },
  assertConversationMember(user: AuthUser, id: string): DbLink {
    const link = byId(db().links, id);
    const member =
      link &&
      ((user.role === 'TRAINER' && link.trainerId === user.trainerId) || (user.role === 'STUDENT' && link.studentId === user.studentId));
    if (!link || !member) throw notFound('Conversa');
    return link;
  },
};

// ---------------------------------------------------------------------------
// Notificações
// ---------------------------------------------------------------------------

export function notify(
  userId: string,
  input: { type: string; title: string; body: string; data?: Record<string, string>; dedupeKey?: string },
  at = nowIso(),
) {
  const d = db();
  if (input.dedupeKey && d.notifications.some((n) => n.userId === userId && n.dedupeKey === input.dedupeKey)) return null;
  const n: DbNotification = {
    id: uuid(),
    userId,
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data ?? {},
    dedupeKey: input.dedupeKey ?? null,
    readAt: null,
    sentAt: at,
    createdAt: at,
  };
  d.notifications.push(n);
  return n;
}

export const notifications = {
  list(userId: string, page: number, pageSize: number, unread?: boolean) {
    const all = db()
      .notifications.filter((n) => n.userId === userId && (!unread || !n.readAt))
      .sort((a, b) => t(b.createdAt) - t(a.createdAt));
    const items = all.slice((page - 1) * pageSize, page * pageSize);
    return {
      items: items.map(({ dedupeKey: _d, sentAt: _s, ...n }) => n),
      total: all.length,
      unread: db().notifications.filter((n) => n.userId === userId && !n.readAt).length,
      page,
      pageSize,
    };
  },
  markRead(userId: string, id: string) {
    const n = db().notifications.find((x) => x.id === id && x.userId === userId);
    if (!n) throw notFound('Notificação');
    if (!n.readAt) n.readAt = nowIso();
  },
  markAllRead(userId: string) {
    const now = nowIso();
    db().notifications.forEach((n) => {
      if (n.userId === userId && !n.readAt) n.readAt = now;
    });
  },
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const ACCESS_TTL_MS = 7 * 86_400_000;
const REFRESH_TTL_MS = 30 * 86_400_000;

export function toPublicUser(u: DbUser) {
  const a = authUserFor(u);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    avatarUrl: u.avatarUrl,
    role: u.role,
    trainerId: a.trainerId,
    studentId: a.studentId,
    hasPassword: Boolean(u.password),
    createdAt: u.createdAt,
  };
}

function issueTokens(u: DbUser) {
  const d = db();
  const now = Date.now();
  // Limpa tokens vencidos para não inflar o armazenamento.
  d.tokens = d.tokens.filter((x) => t(x.expiresAt) > now && !(x.revokedAt && now - t(x.revokedAt) > 86_400_000));
  const accessToken = `demo.${btoa(JSON.stringify({ sub: u.id, role: u.role })).replace(/=+$/, '')}.${randomToken(24)}`;
  const refreshToken = randomToken(48);
  d.tokens.push({ token: accessToken, userId: u.id, kind: 'access', expiresAt: iso(new Date(now + ACCESS_TTL_MS)), revokedAt: null });
  d.tokens.push({ token: refreshToken, userId: u.id, kind: 'refresh', expiresAt: iso(new Date(now + REFRESH_TTL_MS)), revokedAt: null });
  return { accessToken, refreshToken, user: toPublicUser(u) };
}

export function userFromAccessToken(token: string | null): AuthUser | null {
  if (!token) return null;
  const rec = db().tokens.find((x) => x.token === token && x.kind === 'access');
  if (!rec || rec.revokedAt || t(rec.expiresAt) < Date.now()) return null;
  const u = byId(db().users, rec.userId);
  if (!u || u.deletedAt) return null;
  return authUserFor(u);
}

export const auth = {
  register(dto: any) {
    assertStrongPassword(String(dto.password ?? ''));
    if (dto.acceptTerms !== true) throw domain('É necessário aceitar os termos de uso e a política de privacidade', 'TERMS_REQUIRED');
    if (!['STUDENT', 'TRAINER'].includes(dto.role)) throw domain('Perfil inválido');
    const email = normalizeEmail(dto.email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw domain('E-mail inválido');
    if (db().users.some((u) => u.email === email)) throw conflict('Já existe uma conta com este e-mail');
    if (dto.role === 'STUDENT' && dto.inviteCode) invites.preview(dto.inviteCode);
    const user = createAccount({
      email,
      name: String(dto.name ?? '').trim() || email.split('@')[0],
      phone: dto.phone ?? null,
      role: dto.role,
      password: dto.password,
      cref: dto.cref ?? null,
      marketingOptIn: Boolean(dto.marketingOptIn),
    });
    let linkError: string | null = null;
    const a = authUserFor(user);
    if (dto.inviteCode && a.studentId) {
      try {
        invites.accept(a.studentId, dto.inviteCode);
      } catch (e) {
        linkError = (e as Error).message;
      }
    }
    user.lastLoginAt = nowIso();
    return { ...issueTokens(user), linkError };
  },

  login(emailRaw: string, password: string) {
    const u = db().users.find((x) => x.email === normalizeEmail(emailRaw));
    if (!u || u.deletedAt || !u.password || u.password !== password) throw unauthorized('E-mail ou senha inválidos');
    u.lastLoginAt = nowIso();
    return issueTokens(u);
  },

  refresh(refreshToken: string) {
    const d = db();
    const rec = d.tokens.find((x) => x.token === refreshToken && x.kind === 'refresh');
    if (!rec) throw unauthorized('Sessão inválida');
    if (rec.revokedAt) {
      d.tokens.forEach((x) => {
        if (x.userId === rec.userId && !x.revokedAt) x.revokedAt = nowIso();
      });
      throw unauthorized('Sessão inválida');
    }
    const u = byId(d.users, rec.userId);
    if (t(rec.expiresAt) < Date.now() || !u || u.deletedAt) throw unauthorized('Sessão expirada');
    rec.revokedAt = nowIso();
    return issueTokens(u);
  },

  logout(refreshToken: string) {
    db().tokens.forEach((x) => {
      if (x.token === refreshToken && !x.revokedAt) x.revokedAt = nowIso();
    });
  },

  forgotPassword(emailRaw: string) {
    const u = db().users.find((x) => x.email === normalizeEmail(emailRaw));
    if (!u || u.deletedAt) return;
    createPasswordToken(u.id, 1 / 24);
  },

  resetPassword(token: string, password: string) {
    assertStrongPassword(password);
    const rec = db().tokens.find((x) => x.token === token && x.kind === 'reset');
    if (!rec || rec.revokedAt || t(rec.expiresAt) < Date.now()) throw domain('Link de redefinição inválido ou expirado', 'INVALID_TOKEN');
    rec.revokedAt = nowIso();
    const u = userOf(rec.userId);
    u.password = password;
    db().tokens.forEach((x) => {
      if (x.userId === u.id && x.kind !== 'reset' && !x.revokedAt) x.revokedAt = nowIso();
    });
  },

  changePassword(userId: string, dto: any) {
    assertStrongPassword(String(dto.newPassword ?? ''));
    const u = userOf(userId);
    if (u.password && dto.currentPassword !== u.password) throw unauthorized('Senha atual incorreta');
    u.password = dto.newPassword;
  },
};

export function createPasswordToken(userId: string, validDays: number) {
  const token = randomToken(32);
  db().tokens.push({ token, userId, kind: 'reset', expiresAt: iso(new Date(Date.now() + validDays * 86_400_000)), revokedAt: null });
  return token;
}

function createAccount(input: {
  email: string;
  name: string;
  role: 'STUDENT' | 'TRAINER';
  phone?: string | null;
  password?: string | null;
  cref?: string | null;
  marketingOptIn?: boolean;
}): DbUser {
  const d = db();
  const now = nowIso();
  const user: DbUser = {
    id: uuid(),
    email: input.email,
    name: input.name,
    phone: input.phone ?? null,
    avatarUrl: null,
    role: input.role,
    password: input.password ?? null,
    marketingOptIn: input.marketingOptIn ?? false,
    createdAt: now,
    lastLoginAt: null,
    deletedAt: null,
  };
  d.users.push(user);
  if (input.role === 'TRAINER') {
    const trainer = newTrainer(user.id, { inviteCode: uniqueTrainerCode(), cref: input.cref ?? null });
    d.trainers.push(trainer);
    subscriptions.startTrial(trainer.id);
  } else {
    d.students.push(newStudent(user.id, {}));
  }
  return user;
}

export function newTrainer(userId: string, extra: Partial<DbTrainer>): DbTrainer {
  return {
    id: uuid(),
    userId,
    inviteCode: readableCode(6),
    cref: null,
    specialties: [],
    bio: null,
    experienceYears: null,
    socialLinks: {},
    ratingAvg: 0,
    ratingCount: 0,
    gymIds: [],
    availability: [],
    createdAt: nowIso(),
    ...extra,
  };
}

export function newStudent(userId: string, extra: Partial<DbStudent>): DbStudent {
  return {
    id: uuid(),
    userId,
    birthDate: null,
    sex: null,
    heightCm: null,
    initialWeightKg: null,
    currentWeightKg: null,
    goal: null,
    level: 'BEGINNER',
    weeklyFrequency: 3,
    gymId: null,
    createdAt: nowIso(),
    ...extra,
  };
}

function uniqueTrainerCode() {
  for (let i = 0; i < 20; i++) {
    const code = readableCode(6);
    if (!db().trainers.some((x) => x.inviteCode === code) && !db().invites.some((x) => x.code === code)) return code;
  }
  return readableCode(7);
}

// ---------------------------------------------------------------------------
// Assinaturas e planos
// ---------------------------------------------------------------------------

export const subscriptions = {
  listPlans() {
    return db()
      .plans.filter((p) => p.active)
      .sort((a, b) => a.priceCents - b.priceCents);
  },
  startTrial(trainerId: string) {
    const plan = db().plans.find((p) => p.code === 'PERSONAL_PRO');
    if (!plan) return null;
    const now = nowIso();
    const sub = {
      id: uuid(),
      trainerId,
      planId: plan.id,
      status: 'TRIALING' as const,
      provider: 'MANUAL',
      providerSubscriptionId: null,
      providerCustomerId: null,
      currentPeriodStart: now,
      currentPeriodEnd: iso(addDays(new Date(), TRIAL_DAYS)),
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    };
    db().subscriptions.push(sub);
    return sub;
  },
  isEntitled(sub: { status: string; currentPeriodEnd: string } | null | undefined) {
    if (!sub) return false;
    if (sub.status === 'ACTIVE' || sub.status === 'PAST_DUE') return true;
    return sub.status === 'TRIALING' && t(sub.currentPeriodEnd) > Date.now();
  },
  countSeats(trainerId: string) {
    return db().links.filter((l) => l.trainerId === trainerId && (l.status === 'ACTIVE' || l.status === 'PENDING')).length;
  },
  withPlan(trainerId: string) {
    const sub = db().subscriptions.find((s) => s.trainerId === trainerId);
    if (!sub) return null;
    return { ...sub, plan: byId(db().plans, sub.planId)! };
  },
  getForTrainer(trainerId: string) {
    const sub = this.withPlan(trainerId);
    const payments = sub
      ? db()
          .payments.filter((p) => p.subscriptionId === sub.id)
          .sort((a, b) => t(b.createdAt) - t(a.createdAt))
          .slice(0, 12)
      : [];
    return {
      subscription: sub ? { ...sub, payments } : null,
      entitled: this.isEntitled(sub),
      usage: { students: this.countSeats(trainerId), maxStudents: sub?.plan.maxStudents ?? 0 },
    };
  },
  assertCanAddStudent(trainerId: string) {
    const sub = this.withPlan(trainerId);
    if (!this.isEntitled(sub)) throw planLimit('Sua assinatura não está ativa. Escolha um plano para cadastrar alunos.');
    if (!canAddStudent(this.countSeats(trainerId), sub!.plan.maxStudents)) throw planLimit();
  },
  checkout(trainerId: string, planCode: string) {
    const plan = db().plans.find((p) => p.code === planCode && p.active);
    if (!plan) throw notFound('Plano');
    const seats = this.countSeats(trainerId);
    if (!canAddStudent(seats - 1, plan.maxStudents)) {
      throw conflict(`Você possui ${seats} alunos ativos; o plano ${plan.name} permite ${plan.maxStudents}.`);
    }
    // Gateway MANUAL: ativa na hora, sem URL de checkout.
    const periodEnd = iso(addDays(new Date(), plan.interval === 'YEARLY' ? 365 : 30));
    const now = nowIso();
    let sub = db().subscriptions.find((s) => s.trainerId === trainerId);
    if (!sub) {
      sub = {
        id: uuid(),
        trainerId,
        planId: plan.id,
        status: 'ACTIVE',
        provider: 'MANUAL',
        providerSubscriptionId: null,
        providerCustomerId: null,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      };
      db().subscriptions.push(sub);
    } else {
      Object.assign(sub, { planId: plan.id, provider: 'MANUAL', cancelAtPeriodEnd: false, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: periodEnd, updatedAt: now });
    }
    db().payments.push({
      id: uuid(),
      subscriptionId: sub.id,
      provider: 'MANUAL',
      providerPaymentId: null,
      amountCents: plan.priceCents,
      currency: plan.currency,
      status: 'PENDING',
      paidAt: null,
      createdAt: now,
    });
    return { checkoutUrl: null, subscription: { ...sub, plan } };
  },
  cancel(trainerId: string) {
    const sub = db().subscriptions.find((s) => s.trainerId === trainerId);
    if (!sub) throw notFound('Assinatura');
    sub.cancelAtPeriodEnd = true;
    sub.updatedAt = nowIso();
    return sub;
  },
};

// ---------------------------------------------------------------------------
// Convites
// ---------------------------------------------------------------------------

export function normalizePhone(raw?: string) {
  const digits = raw?.replace(/\D/g, '');
  if (!digits) return undefined;
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

export const invites = {
  links(code: string, appUrl: string) {
    return { webUrl: `${appUrl}/convite/${code}`, deepLink: `personalpro://convite/${code}` };
  },
  create(trainerId: string, input: any, appUrl: string, apiUrl: string) {
    subscriptions.assertCanAddStudent(trainerId);
    if (!['CODE', 'QR_CODE', 'EMAIL', 'WHATSAPP'].includes(input.channel)) throw domain('Canal inválido');
    const tu = trainerUser(trainerId);
    let code = readableCode(8);
    while (db().invites.some((i) => i.code === code)) code = readableCode(8);
    const invite = {
      id: uuid(),
      trainerId,
      code,
      channel: input.channel,
      name: input.name ?? null,
      email: input.email?.toLowerCase() ?? null,
      phone: normalizePhone(input.phone) ?? null,
      expiresAt: iso(addDays(new Date(), input.expiresInDays ?? 7)),
      acceptedAt: null,
      studentId: null,
      createdAt: nowIso(),
    };
    db().invites.push(invite);
    const links = this.links(code, appUrl);
    const message =
      `Olá${input.name ? `, ${String(input.name).split(' ')[0]}` : ''}! ${tu.name} convidou você para acompanhar seus treinos no PersonalPro. ` +
      `Baixe o app, crie sua conta e use o código ${code} ou acesse ${links.webUrl}`;
    const whatsappUrl = input.channel === 'WHATSAPP' ? `https://wa.me/${invite.phone ?? ''}?text=${encodeURIComponent(message)}` : null;
    return { invite, ...links, whatsappUrl, message, qrCodeUrl: `${apiUrl}/invites/${code}/qrcode.png` };
  },
  resolveCode(raw: string) {
    const code = String(raw ?? '').trim().toUpperCase();
    const invite = db().invites.find((i) => i.code === code);
    if (invite) {
      if (invite.acceptedAt) throw conflict('Convite já utilizado');
      if (t(invite.expiresAt) < Date.now()) throw conflict('Convite expirado');
      return { trainerId: invite.trainerId, invite };
    }
    const trainer = db().trainers.find((x) => x.inviteCode === code);
    if (!trainer) throw notFound('Código de convite');
    return { trainerId: trainer.id, invite: null };
  },
  preview(code: string) {
    const target = this.resolveCode(code);
    const trainer = trainerById(target.trainerId)!;
    const u = userOf(trainer.userId);
    return {
      code: code.toUpperCase(),
      trainer: { id: trainer.id, name: u.name, avatarUrl: u.avatarUrl, cref: trainer.cref, specialties: trainer.specialties },
      invitedName: target.invite?.name ?? null,
    };
  },
  accept(studentId: string, code: string) {
    const target = this.resolveCode(code);
    const existing = findLink(target.trainerId, studentId);
    if (existing?.status === 'ACTIVE') throw conflict('Você já está vinculado a este professor');
    subscriptions.assertCanAddStudent(target.trainerId);
    if (target.invite) {
      target.invite.acceptedAt = nowIso();
      target.invite.studentId = studentId;
    }
    let link = existing;
    const now = nowIso();
    if (link) Object.assign(link, { status: 'ACTIVE', startedAt: now, endedAt: null });
    else {
      link = { id: uuid(), trainerId: target.trainerId, studentId, status: 'ACTIVE', startedAt: now, endedAt: null, createdAt: now };
      db().links.push(link);
    }
    notify(trainerById(target.trainerId)!.userId, {
      type: 'SYSTEM',
      title: 'Novo aluno vinculado',
      body: `${studentUser(studentId).name} aceitou seu convite.`,
      data: { studentId },
    });
    return link;
  },
};

// ---------------------------------------------------------------------------
// Professores
// ---------------------------------------------------------------------------

export const trainers = {
  serialize(tr: DbTrainer) {
    const u = userOf(tr.userId);
    return {
      id: tr.id,
      user: { id: u.id, name: u.name, email: u.email, phone: u.phone, avatarUrl: u.avatarUrl },
      cref: tr.cref,
      specialties: tr.specialties,
      bio: tr.bio,
      experienceYears: tr.experienceYears,
      socialLinks: tr.socialLinks,
      ratingAvg: tr.ratingAvg,
      ratingCount: tr.ratingCount,
      gyms: tr.gymIds.map((id) => byId(db().gyms, id)).filter(Boolean),
      availability: [...tr.availability].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)),
    };
  },
  getMe(trainerId: string) {
    const tr = trainerById(trainerId)!;
    const count = (s: string) => db().links.filter((l) => l.trainerId === trainerId && l.status === s).length;
    return {
      ...this.serialize(tr),
      inviteCode: tr.inviteCode,
      activeStudents: count('ACTIVE'),
      pendingStudents: count('PENDING'),
      inactiveStudents: count('INACTIVE'),
    };
  },
  updateMe(trainerId: string, dto: any) {
    for (const slot of dto.availability ?? []) {
      if (timeToMinutes(slot.startTime) >= timeToMinutes(slot.endTime)) {
        throw domain('Horário inicial deve ser anterior ao final', 'INVALID_TIME_RANGE');
      }
    }
    const tr = trainerById(trainerId)!;
    const u = userOf(tr.userId);
    if (dto.name) u.name = String(dto.name).trim();
    if (dto.phone !== undefined) u.phone = dto.phone || null;
    if (dto.avatarUrl !== undefined) u.avatarUrl = dto.avatarUrl || null;
    if (dto.cref !== undefined) tr.cref = dto.cref || null;
    if (dto.specialties) tr.specialties = dto.specialties;
    if (dto.bio !== undefined) tr.bio = dto.bio || null;
    if (dto.experienceYears !== undefined) tr.experienceYears = dto.experienceYears ?? null;
    if (dto.socialLinks) tr.socialLinks = dto.socialLinks;
    if (dto.gyms) tr.gymIds = dto.gyms.map((g: any) => upsertGym(g.name, g.city, g.state, g.address));
    if (dto.availability) {
      tr.availability = dto.availability.map((a: any) => ({ id: uuid(), weekday: a.weekday, startTime: a.startTime, endTime: a.endTime }));
    }
    return this.getMe(trainerId);
  },
};

export function upsertGym(name: string, city?: string | null, state?: string | null, address?: string | null): string {
  const n = String(name ?? '').trim();
  const c = city?.trim() ?? '';
  let gym = db().gyms.find((g) => g.name === n && (g.city ?? '') === c);
  if (!gym) {
    gym = { id: uuid(), name: n, city: c, state: state ?? null, address: address ?? null };
    db().gyms.push(gym);
  }
  return gym.id;
}

// ---------------------------------------------------------------------------
// Alunos
// ---------------------------------------------------------------------------

const completedSessions = (studentId: string) =>
  db()
    .sessions.filter((s) => s.studentId === studentId && s.status === 'COMPLETED')
    .sort((a, b) => t(b.startedAt) - t(a.startedAt));

export const students = {
  serialize(s: DbStudent) {
    const u = userOf(s.userId);
    const gym = byId(db().gyms, s.gymId);
    return {
      id: s.id,
      userId: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      avatarUrl: u.avatarUrl,
      birthDate: s.birthDate,
      sex: s.sex,
      heightCm: s.heightCm,
      initialWeightKg: s.initialWeightKg,
      currentWeightKg: s.currentWeightKg,
      weightEvolution: s.initialWeightKg !== null && s.currentWeightKg !== null ? evolution(s.initialWeightKg, s.currentWeightKg) : null,
      goal: s.goal,
      level: s.level,
      weeklyFrequency: s.weeklyFrequency,
      gym: gym ? { id: gym.id, name: gym.name, city: gym.city } : null,
    };
  },

  list(trainerId: string, q: { search?: string; status?: string; goal?: string; level?: string; inactiveDays?: number; sort?: string }) {
    const search = q.search?.trim().toLowerCase();
    const weekStart = startOfWeek(new Date()).getTime();
    let items = db()
      .links.filter((l) => l.trainerId === trainerId && (!q.status || l.status === q.status))
      .map((link) => ({ link, student: studentById(link.studentId)! }))
      .filter(({ student }) => (!q.goal || student.goal === q.goal) && (!q.level || student.level === q.level))
      .filter(({ student }) => {
        if (!search) return true;
        const u = userOf(student.userId);
        return u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search);
      })
      .map(({ link, student }) => {
        const sessions = completedSessions(student.id);
        const lastWorkoutAt = sessions[0]?.startedAt ?? null;
        return {
          ...this.serialize(student),
          linkId: link.id,
          status: link.status,
          startedAt: link.startedAt,
          lastWorkoutAt,
          daysSinceLastWorkout: daysSinceLastWorkout(lastWorkoutAt),
          workoutsThisWeek: sessions.filter((s) => t(s.startedAt) >= weekStart).length,
        };
      });
    if (q.inactiveDays) {
      items = items.filter((s) => s.daysSinceLastWorkout === null || s.daysSinceLastWorkout >= q.inactiveDays!);
    }
    items.sort((a, b) => {
      if (q.sort === 'lastWorkout') return t(b.lastWorkoutAt) - t(a.lastWorkoutAt);
      if (q.sort === 'startedAt') return t(b.startedAt) - t(a.startedAt);
      return a.name.localeCompare(b.name, 'pt-BR');
    });
    return items;
  },

  createManual(trainerId: string, dto: any, appUrl: string, apiUrl: string) {
    subscriptions.assertCanAddStudent(trainerId);
    const email = normalizeEmail(dto.email);
    if (!dto.name || !email) throw domain('Informe nome e e-mail');
    const existing = db().users.find((u) => u.email === email);
    if (existing) {
      if (existing.role !== 'STUDENT') throw conflict('Este e-mail pertence a uma conta que não é de aluno');
      const invite = invites.create(trainerId, { channel: 'EMAIL', email, name: dto.name }, appUrl, apiUrl);
      return { invited: true, student: null, invite };
    }
    const now = nowIso();
    const user: DbUser = {
      id: uuid(),
      email,
      name: String(dto.name).trim(),
      phone: dto.phone ?? null,
      avatarUrl: null,
      role: 'STUDENT',
      password: null,
      marketingOptIn: false,
      createdAt: now,
      lastLoginAt: null,
      deletedAt: null,
    };
    db().users.push(user);
    const student = newStudent(user.id, {
      ...profileData(dto),
      initialWeightKg: dto.initialWeightKg ?? dto.currentWeightKg ?? null,
      gymId: dto.gymName ? upsertGym(dto.gymName, dto.gymCity) : null,
    });
    db().students.push(student);
    db().links.push({
      id: uuid(),
      trainerId,
      studentId: student.id,
      status: 'ACTIVE',
      startedAt: dto.startedAt ? iso(new Date(dto.startedAt)) : now,
      endedAt: null,
      createdAt: now,
    });
    createPasswordToken(user.id, 7);
    return { invited: false, student: this.serialize(student), invite: null };
  },

  detail(user: AuthUser, studentIdParam: string) {
    const studentId = access.resolveStudentId(user, studentIdParam);
    const student = studentById(studentId)!;
    const links = db().links.filter((l) => l.studentId === studentId && (user.role !== 'TRAINER' || l.trainerId === user.trainerId));
    const sessions = completedSessions(studentId);
    const goals = db().goals.filter((g) => g.studentId === studentId && g.status === 'ACTIVE');
    const lastAssessment = db()
      .assessments.filter((a) => a.studentId === studentId && a.status === 'COMPLETED')
      .sort((a, b) => t(b.assessedAt) - t(a.assessedAt))[0];
    return {
      ...this.serialize(student),
      trainers: links.map((l) => {
        const tu = trainerUser(l.trainerId);
        return { linkId: l.id, trainerId: l.trainerId, name: tu.name, avatarUrl: tu.avatarUrl, status: l.status, startedAt: l.startedAt };
      }),
      lastWorkoutAt: sessions[0]?.startedAt ?? null,
      totalWorkouts: sessions.length,
      stats: trainingStats(sessions),
      frequencySeries: weeklyFrequencySeries(sessions, 8),
      activeGoals: goals.length,
      lastAssessmentAt: lastAssessment?.assessedAt ?? null,
    };
  },

  update(user: AuthUser, studentIdParam: string, dto: any) {
    const studentId = access.resolveStudentId(user, studentIdParam);
    const student = studentById(studentId)!;
    const u = userOf(student.userId);
    if (dto.name !== undefined && dto.name) u.name = String(dto.name).trim();
    if (dto.phone !== undefined) u.phone = dto.phone || null;
    if (dto.avatarUrl !== undefined) u.avatarUrl = dto.avatarUrl || null;
    const data = profileData(dto);
    for (const [k, v] of Object.entries(data)) if (v !== undefined) (student as any)[k] = v;
    if (dto.gymName !== undefined) student.gymId = String(dto.gymName).trim() ? upsertGym(dto.gymName, dto.gymCity) : null;
    return this.detail(user, studentId);
  },

  updateLink(trainerId: string, studentId: string, dto: any) {
    const link = access.assertTrainerHasLink(trainerId, studentId);
    if (dto.status === 'ACTIVE' && link.status !== 'ACTIVE') subscriptions.assertCanAddStudent(trainerId);
    if (dto.status) link.status = dto.status;
    if (dto.startedAt) link.startedAt = iso(new Date(dto.startedAt));
    if (dto.status === 'INACTIVE') link.endedAt = nowIso();
    else if (dto.status === 'ACTIVE') link.endedAt = null;
    return link;
  },
};

function profileData(dto: any): Partial<DbStudent> {
  const n = (v: unknown) => (v === undefined ? undefined : v === null || v === '' ? null : Number(v));
  return {
    birthDate: dto.birthDate ? iso(new Date(dto.birthDate)) : undefined,
    sex: dto.sex,
    heightCm: n(dto.heightCm) as number | undefined,
    initialWeightKg: n(dto.initialWeightKg) as number | undefined,
    currentWeightKg: n(dto.currentWeightKg) as number | undefined,
    goal: dto.goal,
    level: dto.level,
    weeklyFrequency: dto.weeklyFrequency !== undefined ? Number(dto.weeklyFrequency) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Exercícios
// ---------------------------------------------------------------------------

const MUSCLE_ORDER = ['CHEST', 'BACK', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'QUADRICEPS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'ABS', 'CARDIO', 'MOBILITY'];

export const exercises = {
  serialize(e: DbExercise) {
    return { ...e, updatedAt: e.createdAt };
  },
  visibleTrainerIds(user: AuthUser): string[] {
    if (user.role === 'TRAINER') return [user.trainerId!];
    if (user.role === 'STUDENT') {
      return db()
        .links.filter((l) => l.studentId === user.studentId && l.status !== 'INACTIVE')
        .map((l) => l.trainerId);
    }
    return [];
  },
  list(user: AuthUser, q: { scope?: string; muscleGroup?: string; search?: string }) {
    const ids = this.visibleTrainerIds(user);
    const scope = q.scope ?? 'all';
    const search = q.search?.trim().toLowerCase();
    return db()
      .exercises.filter((e) => !e.archivedAt)
      .filter((e) =>
        scope === 'library' ? e.trainerId === null : scope === 'custom' ? e.trainerId !== null && ids.includes(e.trainerId) : e.trainerId === null || ids.includes(e.trainerId),
      )
      .filter((e) => !q.muscleGroup || e.muscleGroup === q.muscleGroup)
      .filter((e) => !search || e.name.toLowerCase().includes(search))
      .sort((a, b) => MUSCLE_ORDER.indexOf(a.muscleGroup) - MUSCLE_ORDER.indexOf(b.muscleGroup) || a.name.localeCompare(b.name, 'pt-BR'))
      .map((e) => this.serialize(e));
  },
  get(user: AuthUser, id: string) {
    const ids = this.visibleTrainerIds(user);
    const e = db().exercises.find((x) => x.id === id && !x.archivedAt && (x.trainerId === null || ids.includes(x.trainerId)));
    if (!e) throw notFound('Exercício');
    return this.serialize(e);
  },
  assertUsable(trainerId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    const count = db().exercises.filter((e) => unique.includes(e.id) && !e.archivedAt && (e.trainerId === null || e.trainerId === trainerId)).length;
    if (count !== unique.length) throw notFound('Exercício');
  },
  create(trainerId: string, dto: any) {
    if (!dto.name || String(dto.name).trim().length < 2) throw domain('Informe o nome do exercício');
    const e: DbExercise = {
      id: uuid(),
      trainerId,
      name: String(dto.name).trim(),
      description: dto.description ?? null,
      muscleGroup: dto.muscleGroup,
      equipment: dto.equipment ?? null,
      imageUrl: dto.imageUrl ?? null,
      videoUrl: dto.videoUrl ?? null,
      instructions: dto.instructions ?? [],
      commonMistakes: dto.commonMistakes ?? [],
      archivedAt: null,
      createdAt: nowIso(),
    };
    db().exercises.push(e);
    return this.serialize(e);
  },
  own(trainerId: string, id: string) {
    const e = db().exercises.find((x) => x.id === id && x.trainerId === trainerId);
    if (!e) throw notFound('Exercício personalizado');
    return e;
  },
  update(trainerId: string, id: string, dto: any) {
    const e = this.own(trainerId, id);
    for (const k of ['name', 'description', 'muscleGroup', 'equipment', 'imageUrl', 'videoUrl', 'instructions', 'commonMistakes']) {
      if (dto[k] !== undefined) (e as any)[k] = dto[k];
    }
    return this.serialize(e);
  },
  remove(trainerId: string, id: string) {
    this.own(trainerId, id);
    const used = db().workoutExercises.some((w) => w.exerciseId === id) || db().sets.some((s) => s.exerciseId === id);
    if (used) throw conflict('Exercício em uso em fichas ou históricos; remova-o das fichas antes');
    db().exercises = db().exercises.filter((e) => e.id !== id);
  },
};

// ---------------------------------------------------------------------------
// Treinos
// ---------------------------------------------------------------------------

export const workouts = {
  /** Mesmo formato do Prisma + workoutInclude (suggestedLoadKg Decimal → string). */
  serialize(w: DbWorkout) {
    const items = db()
      .workoutExercises.filter((we) => we.workoutId === w.id)
      .sort((a, b) => a.order - b.order)
      .map((we) => ({
        ...we,
        suggestedLoadKg: we.suggestedLoadKg === null ? null : String(we.suggestedLoadKg),
        exercise: exercises.serialize(byId(db().exercises, we.exerciseId)!),
      }));
    return { ...w, exercises: items };
  },
  list(trainerId: string, q: { templates?: boolean; studentId?: string }) {
    return db()
      .workouts.filter((w) => w.trainerId === trainerId)
      .filter((w) => q.templates === undefined || w.isTemplate === q.templates)
      .filter((w) => !q.studentId || db().studentWorkouts.some((sw) => sw.workoutId === w.id && sw.studentId === q.studentId))
      .sort((a, b) => (a.label ?? '￿').localeCompare(b.label ?? '￿') || a.name.localeCompare(b.name, 'pt-BR'))
      .map((w) => ({
        ...this.serialize(w),
        studentWorkouts: db()
          .studentWorkouts.filter((sw) => sw.workoutId === w.id)
          .map((sw) => {
            const su = studentUser(sw.studentId);
            return { ...sw, student: { ...studentById(sw.studentId)!, user: { name: su.name, avatarUrl: su.avatarUrl } } };
          }),
      }));
  },
  get(user: AuthUser, id: string) {
    const w = byId(db().workouts, id);
    const ok =
      w &&
      (user.role === 'TRAINER'
        ? w.trainerId === user.trainerId
        : user.role === 'STUDENT' && db().studentWorkouts.some((sw) => sw.workoutId === id && sw.studentId === user.studentId));
    if (!w || !ok) throw notFound('Treino');
    return this.serialize(w);
  },
  validate(dto: any) {
    const errors: string[] = [];
    if (!dto?.name || String(dto.name).trim().length < 1) errors.push('name must be longer than or equal to 1 characters');
    if (!Array.isArray(dto?.exercises)) errors.push('exercises must be an array');
    if (errors.length) throw domain(errors[0]);
  },
  exerciseData(e: any, order: number) {
    return {
      exerciseId: e.exerciseId,
      order,
      sets: Number(e.sets) || 1,
      reps: String(e.reps ?? '10'),
      suggestedLoadKg: e.suggestedLoadKg === undefined || e.suggestedLoadKg === null || e.suggestedLoadKg === '' ? null : Number(e.suggestedLoadKg),
      restSeconds: e.restSeconds ?? 60,
      technique: e.technique ?? 'NORMAL',
      groupKey: e.groupKey ?? null,
      notes: e.notes ?? null,
    };
  },
  create(trainerId: string, dto: any) {
    this.validate(dto);
    exercises.assertUsable(trainerId, dto.exercises.map((e: any) => e.exerciseId));
    const now = nowIso();
    const w: DbWorkout = {
      id: uuid(),
      trainerId,
      name: dto.name,
      label: dto.label ?? null,
      description: dto.description ?? null,
      isTemplate: dto.isTemplate ?? false,
      createdAt: now,
      updatedAt: now,
    };
    db().workouts.push(w);
    dto.exercises.forEach((e: any, i: number) => db().workoutExercises.push({ id: uuid(), workoutId: w.id, ...this.exerciseData(e, i) }));
    return this.serialize(w);
  },
  assertOwn(trainerId: string, id: string) {
    const w = db().workouts.find((x) => x.id === id && x.trainerId === trainerId);
    if (!w) throw notFound('Treino');
    return w;
  },
  update(trainerId: string, id: string, dto: any) {
    const w = this.assertOwn(trainerId, id);
    this.validate(dto);
    exercises.assertUsable(trainerId, dto.exercises.map((e: any) => e.exerciseId));
    const current = db().workoutExercises.filter((we) => we.workoutId === id);
    const currentIds = new Set(current.map((e) => e.id));
    const keep = new Set(dto.exercises.filter((e: any) => e.id && currentIds.has(e.id)).map((e: any) => e.id));
    db().workoutExercises = db().workoutExercises.filter((we) => we.workoutId !== id || keep.has(we.id));
    dto.exercises.forEach((e: any, i: number) => {
      if (e.id && currentIds.has(e.id)) Object.assign(byId(db().workoutExercises, e.id)!, this.exerciseData(e, i));
      else db().workoutExercises.push({ id: uuid(), workoutId: id, ...this.exerciseData(e, i) });
    });
    Object.assign(w, {
      name: dto.name,
      label: dto.label ?? null,
      description: dto.description ?? null,
      isTemplate: dto.isTemplate ?? w.isTemplate,
      updatedAt: nowIso(),
    });
    for (const sw of db().studentWorkouts.filter((x) => x.workoutId === id && x.active)) {
      notify(studentById(sw.studentId)!.userId, {
        type: 'WORKOUT_UPDATED',
        title: 'Treino atualizado',
        body: 'Seu professor atualizou seu treino.',
        data: { workoutId: id },
      });
    }
    return this.serialize(w);
  },
  remove(trainerId: string, id: string) {
    this.assertOwn(trainerId, id);
    const d = db();
    d.workouts = d.workouts.filter((w) => w.id !== id);
    const weIds = new Set(d.workoutExercises.filter((we) => we.workoutId === id).map((we) => we.id));
    d.workoutExercises = d.workoutExercises.filter((we) => we.workoutId !== id);
    d.studentWorkouts = d.studentWorkouts.filter((sw) => sw.workoutId !== id);
    // Histórico preservado (workout_id SET NULL)
    d.sessions.forEach((s) => {
      if (s.workoutId === id) {
        s.workoutId = null;
        s.studentWorkoutId = null;
      }
    });
    d.sets.forEach((s) => {
      if (s.workoutExerciseId && weIds.has(s.workoutExerciseId)) s.workoutExerciseId = null;
    });
  },
  duplicate(trainerId: string, id: string) {
    const src = this.assertOwn(trainerId, id);
    const now = nowIso();
    const w: DbWorkout = { ...src, id: uuid(), name: `${src.name} (cópia)`, createdAt: now, updatedAt: now };
    db().workouts.push(w);
    db()
      .workoutExercises.filter((we) => we.workoutId === id)
      .forEach((we) => db().workoutExercises.push({ ...we, id: uuid(), workoutId: w.id }));
    return this.serialize(w);
  },
  assign(trainerId: string, workoutId: string, dto: any) {
    this.assertOwn(trainerId, workoutId);
    access.assertTrainerCanAccessStudent(trainerId, dto.studentId);
    let sw = db().studentWorkouts.find((x) => x.studentId === dto.studentId && x.workoutId === workoutId);
    if (sw) Object.assign(sw, { weekdays: dto.weekdays ?? sw.weekdays, order: dto.order ?? sw.order, active: true, endsAt: null });
    else {
      sw = {
        id: uuid(),
        studentId: dto.studentId,
        workoutId,
        weekdays: dto.weekdays ?? [],
        order: dto.order ?? 0,
        active: true,
        startsAt: nowIso(),
        endsAt: null,
        createdAt: nowIso(),
      };
      db().studentWorkouts.push(sw);
    }
    notify(studentById(dto.studentId)!.userId, {
      type: 'WORKOUT_UPDATED',
      title: 'Novo treino disponível',
      body: 'Seu professor atualizou seu treino.',
      data: { workoutId },
    });
    return sw;
  },
  unassign(trainerId: string, workoutId: string, studentId: string) {
    this.assertOwn(trainerId, workoutId);
    access.assertTrainerCanAccessStudent(trainerId, studentId);
    db().studentWorkouts.forEach((sw) => {
      if (sw.workoutId === workoutId && sw.studentId === studentId) {
        sw.active = false;
        sw.endsAt = nowIso();
      }
    });
  },
  activeAssignments(studentId: string, trainerId?: string) {
    return db()
      .studentWorkouts.filter((sw) => sw.studentId === studentId && sw.active)
      .filter((sw) => !trainerId || byId(db().workouts, sw.workoutId)?.trainerId === trainerId)
      .sort((a, b) => a.order - b.order || t(a.createdAt) - t(b.createdAt));
  },
  forStudent(user: AuthUser, studentIdParam?: string) {
    const studentId = access.resolveStudentId(user, studentIdParam);
    return this.activeAssignments(studentId, user.role === 'TRAINER' ? user.trainerId! : undefined).map((a) => ({
      assignmentId: a.id,
      weekdays: a.weekdays,
      order: a.order,
      startsAt: a.startsAt,
      ...this.serialize(byId(db().workouts, a.workoutId)!),
    }));
  },
  today(studentId: string, reference = new Date()) {
    const assignments = this.activeAssignments(studentId);
    if (!assignments.length) return null;
    const weekday = reference.getDay();
    const scheduled = assignments.find((a) => a.weekdays.includes(weekday));
    let chosen = scheduled;
    if (!chosen) {
      const last = completedSessions(studentId).find((s) => s.workoutId);
      const lastIndex = assignments.findIndex((a) => a.workoutId === last?.workoutId);
      chosen = assignments[(lastIndex + 1) % assignments.length];
    }
    const dayStart = startOfDay(reference).getTime();
    const doneToday = db().sessions.some(
      (s) => s.studentId === studentId && s.workoutId === chosen!.workoutId && s.status === 'COMPLETED' && t(s.startedAt) >= dayStart,
    );
    return {
      assignmentId: chosen.id,
      scheduledForToday: Boolean(scheduled),
      completedToday: doneToday,
      ...this.serialize(byId(db().workouts, chosen.workoutId)!),
    };
  },
};

// ---------------------------------------------------------------------------
// Execução de treino (sessões)
// ---------------------------------------------------------------------------

const STALE_SESSION_MS = 6 * 3600_000;

export const sessions = {
  start(studentId: string, workoutId: string) {
    const assignment = db().studentWorkouts.find((sw) => sw.studentId === studentId && sw.workoutId === workoutId && sw.active);
    if (!assignment) throw notFound('Treino');
    const open = db()
      .sessions.filter((s) => s.studentId === studentId && s.status === 'IN_PROGRESS')
      .sort((a, b) => t(b.startedAt) - t(a.startedAt))[0];
    if (open) {
      const stale = Date.now() - t(open.startedAt) > STALE_SESSION_MS;
      if (!stale && open.workoutId === workoutId) return this.executionView(open.id);
      open.status = 'ABANDONED';
    }
    const now = nowIso();
    const session = {
      id: uuid(),
      studentId,
      workoutId,
      studentWorkoutId: assignment.id,
      status: 'IN_PROGRESS' as const,
      startedAt: now,
      finishedAt: null,
      durationSeconds: null,
      totalVolumeKg: null,
      estimatedCalories: null,
      perceivedEffort: null,
      notes: null,
      createdAt: now,
    };
    db().sessions.push(session);
    return this.executionView(session.id);
  },
  active(studentId: string) {
    const open = db()
      .sessions.filter((s) => s.studentId === studentId && s.status === 'IN_PROGRESS' && Date.now() - t(s.startedAt) < STALE_SESSION_MS)
      .sort((a, b) => t(b.startedAt) - t(a.startedAt))[0];
    return open ? this.executionView(open.id) : null;
  },
  get(user: AuthUser, id: string) {
    const s = byId(db().sessions, id);
    if (!s) throw notFound('Sessão');
    access.resolveStudentId(user, s.studentId);
    return this.executionView(id);
  },
  executionView(sessionId: string) {
    const d = db();
    const session = byId(d.sessions, sessionId)!;
    const workout = byId(d.workouts, session.workoutId);
    const wes = workout ? d.workoutExercises.filter((we) => we.workoutId === workout.id).sort((a, b) => a.order - b.order) : [];
    const exerciseIds = wes.map((e) => e.exerciseId);
    const sessionById = new Map(d.sessions.map((s) => [s.id, s]));
    const previousSets = d.sets
      .filter((s) => {
        const ss = sessionById.get(s.sessionId);
        return exerciseIds.includes(s.exerciseId) && ss && ss.studentId === session.studentId && ss.status === 'COMPLETED' && ss.id !== sessionId;
      })
      .sort((a, b) => t(b.completedAt) - t(a.completedAt));
    const todaySets = d.sets.filter((s) => s.sessionId === sessionId).sort((a, b) => t(a.completedAt) - t(b.completedAt));
    const exs = wes.map((we) => {
      const ex = byId(d.exercises, we.exerciseId)!;
      const history = previousSets.filter((s) => s.exerciseId === we.exerciseId);
      const lastSessionId = history[0]?.sessionId;
      const lastSets = history
        .filter((s) => s.sessionId === lastSessionId)
        .sort((a, b) => a.setNumber - b.setNumber)
        .map((s) => ({ setNumber: s.setNumber, loadKg: s.loadKg, reps: s.reps }));
      return {
        workoutExerciseId: we.id,
        exerciseId: we.exerciseId,
        order: we.order,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        imageUrl: ex.imageUrl,
        videoUrl: ex.videoUrl,
        instructions: ex.instructions,
        sets: we.sets,
        reps: we.reps,
        suggestedLoadKg: we.suggestedLoadKg,
        restSeconds: we.restSeconds,
        technique: we.technique,
        groupKey: we.groupKey,
        notes: we.notes,
        previous: lastSets.length ? { date: sessionById.get(lastSessionId!)!.startedAt, sets: lastSets } : null,
        personalBest: bestSet(history.map((s) => ({ loadKg: s.loadKg, reps: s.reps }))),
        today: todaySets
          .filter((s) => s.exerciseId === we.exerciseId)
          .map((s) => ({ id: s.id, setNumber: s.setNumber, loadKg: s.loadKg, reps: s.reps, rpe: s.rpe, notes: s.notes, isPersonalRecord: s.isPersonalRecord })),
      };
    });
    return {
      id: session.id,
      status: session.status,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      durationSeconds: session.durationSeconds,
      totalVolumeKg: session.totalVolumeKg,
      estimatedCalories: session.estimatedCalories,
      perceivedEffort: session.perceivedEffort,
      notes: session.notes,
      workout: workout ? { id: workout.id, name: workout.name, label: workout.label } : null,
      exercises: exs,
    };
  },
  ownOpenSession(studentId: string, sessionId: string) {
    const s = db().sessions.find((x) => x.id === sessionId && x.studentId === studentId);
    if (!s) throw notFound('Sessão');
    if (s.status !== 'IN_PROGRESS') throw conflict('Este treino já foi encerrado');
    return s;
  },
  logSet(studentId: string, sessionId: string, dto: any) {
    const session = this.ownOpenSession(studentId, sessionId);
    const d = db();
    const loadKg = Number(dto.loadKg ?? 0);
    const reps = Number(dto.reps ?? 0);
    const setNumber = Number(dto.setNumber);
    if (!dto.exerciseId || !Number.isFinite(setNumber) || setNumber < 1) throw domain('Dados da série inválidos');
    const we = dto.workoutExerciseId
      ? d.workoutExercises.find((x) => x.id === dto.workoutExerciseId && x.workoutId === session.workoutId)
      : d.workoutExercises.find((x) => x.workoutId === session.workoutId && x.exerciseId === dto.exerciseId);
    if (dto.workoutExerciseId && !we) throw notFound('Exercício da ficha');
    const studentSessionIds = new Set(d.sessions.filter((s) => s.studentId === studentId).map((s) => s.id));
    const previous = d.sets.filter(
      (s) => s.exerciseId === dto.exerciseId && studentSessionIds.has(s.sessionId) && !(s.sessionId === sessionId && s.setNumber === setNumber),
    );
    const pr = isPersonalRecord({ loadKg, reps }, bestSet(previous.map((s) => ({ loadKg: s.loadKg, reps: s.reps }))));
    let set = d.sets.find((s) => s.sessionId === sessionId && s.exerciseId === dto.exerciseId && s.setNumber === setNumber);
    const data = {
      workoutExerciseId: we?.id ?? null,
      loadKg,
      reps,
      rpe: dto.rpe ?? null,
      notes: dto.notes ?? null,
      isPersonalRecord: pr,
      completedAt: nowIso(),
    };
    if (set) Object.assign(set, data);
    else {
      set = { id: uuid(), sessionId, exerciseId: dto.exerciseId, setNumber, ...data };
      d.sets.push(set);
    }
    const ex = byId(d.exercises, dto.exerciseId)!;
    if (pr) {
      const su = studentUser(studentId);
      notify(su.id, {
        type: 'PERSONAL_RECORD',
        title: 'Novo recorde! 💪',
        body: `Você bateu seu recorde no ${ex.name.toLowerCase()}: ${loadKg.toLocaleString('pt-BR')} kg.`,
        data: { exerciseId: ex.id, sessionId },
        dedupeKey: `pr:${sessionId}:${ex.id}`,
      });
      const link = access.primaryLinkForStudent(studentId);
      if (link) {
        notify(trainerById(link.trainerId)!.userId, {
          type: 'PERSONAL_RECORD',
          title: 'Recorde de aluno',
          body: `${su.name} bateu o recorde no ${ex.name.toLowerCase()}: ${loadKg.toLocaleString('pt-BR')} kg.`,
          data: { exerciseId: ex.id, studentId },
          dedupeKey: `pr:${sessionId}:${ex.id}`,
        });
      }
    }
    return {
      set: { ...set, exercise: { name: ex.name } },
      isPersonalRecord: pr,
      restSeconds: we?.restSeconds ?? 60,
    };
  },
  deleteSet(studentId: string, sessionId: string, setId: string) {
    this.ownOpenSession(studentId, sessionId);
    const before = db().sets.length;
    db().sets = db().sets.filter((s) => !(s.id === setId && s.sessionId === sessionId));
    if (db().sets.length === before) throw notFound('Série');
  },
  finish(studentId: string, sessionId: string, dto: any) {
    const session = this.ownOpenSession(studentId, sessionId);
    const d = db();
    const sets = d.sets.filter((s) => s.sessionId === sessionId);
    const student = studentById(studentId)!;
    const finishedAt = new Date();
    const durationSeconds = Math.max(0, Math.round((finishedAt.getTime() - t(session.startedAt)) / 1000));
    const volume = totalVolume(sets.map((s) => ({ loadKg: s.loadKg, reps: s.reps })));
    const estimatedCalories = estimateCalories({ durationSeconds, bodyWeightKg: student.currentWeightKg, perceivedEffort: dto.perceivedEffort });
    Object.assign(session, {
      status: 'COMPLETED',
      finishedAt: iso(finishedAt),
      durationSeconds,
      totalVolumeKg: volume,
      estimatedCalories,
      perceivedEffort: dto.perceivedEffort ?? null,
      notes: dto.notes ?? null,
    });
    const completedCount = d.sessions.filter((s) => s.studentId === studentId && s.status === 'COMPLETED').length;
    if (isWorkoutMilestone(completedCount)) {
      notify(student.userId, {
        type: 'MILESTONE',
        title: 'Parabéns! 🏆',
        body: completedCount === 1 ? 'Você completou seu primeiro treino!' : `Parabéns! Você completou ${completedCount} treinos.`,
        dedupeKey: `milestone:${completedCount}`,
      });
    }
    goals.refreshForStudent(studentId);
    return {
      ...this.executionView(sessionId),
      summary: {
        startedAt: session.startedAt,
        finishedAt: iso(finishedAt),
        durationSeconds,
        totalVolumeKg: volume,
        estimatedCalories,
        setsCount: sets.length,
        exercisesCount: new Set(sets.map((s) => s.exerciseId)).size,
        personalRecords: sets
          .filter((s) => s.isPersonalRecord)
          .map((s) => ({ exercise: byId(d.exercises, s.exerciseId)!.name, loadKg: s.loadKg, reps: s.reps })),
        totalWorkouts: completedCount,
      },
    };
  },
  abandon(studentId: string, sessionId: string) {
    this.ownOpenSession(studentId, sessionId).status = 'ABANDONED';
  },
  history(user: AuthUser, q: { studentId?: string; from?: string; to?: string; page: number; pageSize: number }) {
    const studentId = access.resolveStudentId(user, q.studentId);
    const all = completedSessions(studentId).filter(
      (s) => (!q.from || t(s.startedAt) >= t(q.from)) && (!q.to || t(s.startedAt) <= t(q.to)),
    );
    const items = all.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map((s) => {
      const w = byId(db().workouts, s.workoutId);
      return {
        id: s.id,
        workout: w ? { id: w.id, name: w.name, label: w.label } : null,
        startedAt: s.startedAt,
        finishedAt: s.finishedAt,
        durationSeconds: s.durationSeconds,
        totalVolumeKg: s.totalVolumeKg,
        estimatedCalories: s.estimatedCalories,
        perceivedEffort: s.perceivedEffort,
        setsCount: db().sets.filter((x) => x.sessionId === s.id).length,
      };
    });
    return { items, total: all.length, page: q.page, pageSize: q.pageSize };
  },
};

// ---------------------------------------------------------------------------
// Evolução
// ---------------------------------------------------------------------------

function completedSetsOf(studentId: string, exerciseId?: string) {
  const d = db();
  const ok = new Set(d.sessions.filter((s) => s.studentId === studentId && s.status === 'COMPLETED').map((s) => s.id));
  return d.sets
    .filter((s) => ok.has(s.sessionId) && (!exerciseId || s.exerciseId === exerciseId))
    .sort((a, b) => t(a.completedAt) - t(b.completedAt));
}

export const progress = {
  stats(user: AuthUser, studentIdParam: string | undefined, weeks: number) {
    const studentId = access.resolveStudentId(user, studentIdParam);
    const student = studentById(studentId)!;
    const list = completedSessions(studentId).reverse();
    const now = new Date();
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const dd = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const key = `${dd.getFullYear()}-${`${dd.getMonth() + 1}`.padStart(2, '0')}`;
      return { month: key, count: list.filter((s) => toDateKey(s.startedAt).startsWith(key)).length };
    });
    return {
      ...trainingStats(list, now),
      plannedPerWeek: student.weeklyFrequency,
      totalWorkouts: list.length,
      totalVolumeKg: Math.round(list.reduce((acc, s) => acc + (s.totalVolumeKg ?? 0), 0)),
      weeklySeries: weeklyFrequencySeries(list, weeks, now),
      monthlySeries: monthly,
    };
  },
  exercises(user: AuthUser, studentIdParam?: string) {
    const studentId = access.resolveStudentId(user, studentIdParam);
    const byEx = new Map<string, ReturnType<typeof completedSetsOf>>();
    for (const s of completedSetsOf(studentId)) byEx.set(s.exerciseId, [...(byEx.get(s.exerciseId) ?? []), s]);
    return [...byEx.entries()]
      .map(([exerciseId, list]) => {
        const ex = byId(db().exercises, exerciseId)!;
        const points = loadProgression(list.map((s) => ({ completedAt: s.completedAt, loadKg: s.loadKg, reps: s.reps })));
        const first = points[0];
        const last = points[points.length - 1];
        return {
          exerciseId,
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          sessions: points.length,
          firstLoadKg: first.loadKg,
          lastLoadKg: last.loadKg,
          bestLoadKg: Math.max(...points.map((p) => p.loadKg)),
          deltaKg: Math.round((last.loadKg - first.loadKg) * 10) / 10,
          lastDate: last.date,
        };
      })
      .sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  },
  exercise(user: AuthUser, exerciseId: string, studentIdParam?: string) {
    const studentId = access.resolveStudentId(user, studentIdParam);
    const ex = byId(db().exercises, exerciseId);
    if (!ex) throw notFound('Exercício');
    const points = loadProgression(completedSetsOf(studentId, exerciseId).map((s) => ({ completedAt: s.completedAt, loadKg: s.loadKg, reps: s.reps })));
    return {
      exercise: { id: ex.id, name: ex.name, muscleGroup: ex.muscleGroup },
      points: points.map((p) => ({ ...p, estimatedOneRepMaxKg: estimateOneRepMax(p) })),
      evolution: points.length ? evolution(points[0].loadKg, points[points.length - 1].loadKg) : null,
    };
  },
  body(user: AuthUser, studentIdParam?: string) {
    const studentId = access.resolveStudentId(user, studentIdParam);
    const student = studentById(studentId)!;
    const series = db()
      .assessments.filter((a) => a.studentId === studentId && a.status === 'COMPLETED')
      .sort((a, b) => t(a.assessedAt) - t(b.assessedAt))
      .map((a) => ({
        assessmentId: a.id,
        date: a.assessedAt,
        weightKg: a.weightKg,
        bmi: a.bmi,
        bodyFatPct: a.bodyFatPct,
        muscleMassKg: a.muscleMassKg,
        leanMassKg: a.leanMassKg,
        visceralFat: a.visceralFat,
        measurements: Object.fromEntries(BODY_MEASUREMENT_KEYS.map((k) => [k, a.measurements?.[k] ?? null])),
      }));
    const firstLast = (pick: (p: (typeof series)[number]) => number | null) => {
      const values = series.map(pick).filter((v): v is number => v !== null);
      return values.length ? evolution(values[0], values[values.length - 1]) : null;
    };
    return {
      weight:
        student.initialWeightKg !== null && student.currentWeightKg !== null
          ? evolution(student.initialWeightKg, student.currentWeightKg)
          : firstLast((p) => p.weightKg),
      bodyFat: firstLast((p) => p.bodyFatPct),
      muscleMass: firstLast((p) => p.muscleMassKg),
      series,
    };
  },
};

// ---------------------------------------------------------------------------
// Avaliações
// ---------------------------------------------------------------------------

export const assessments = {
  serialize(a: DbAssessment) {
    const { createdAt: _c, ...rest } = a;
    return {
      ...rest,
      measurements: a.measurements ? Object.fromEntries(BODY_MEASUREMENT_KEYS.map((k) => [k, a.measurements![k] ?? null])) : null,
      photos: [...a.photos].sort((x, y) => x.angle.localeCompare(y.angle)),
    };
  },
  compute(dto: any, studentHeight: number | null) {
    const height = dto.heightCm ?? studentHeight ?? undefined;
    const bmi = dto.weightKg && height ? calculateBmi(dto.weightKg, height) : null;
    const leanMass =
      dto.leanMassKg ?? (dto.weightKg && dto.bodyFatPct !== undefined && dto.bodyFatPct !== null ? calculateLeanMass(dto.weightKg, dto.bodyFatPct) : null);
    return {
      weightKg: dto.weightKg ?? null,
      heightCm: height ?? null,
      bmi: bmi ?? null,
      bodyFatPct: dto.bodyFatPct ?? null,
      muscleMassKg: dto.muscleMassKg ?? null,
      leanMassKg: leanMass ?? null,
      visceralFat: dto.visceralFat ?? null,
    };
  },
  create(user: AuthUser, dto: any) {
    const studentId = access.resolveStudentId(user, dto.studentId);
    const student = studentById(studentId)!;
    const a: DbAssessment = {
      id: uuid(),
      studentId,
      trainerId: user.role === 'TRAINER' ? user.trainerId : null,
      status: 'COMPLETED',
      scheduledFor: null,
      assessedAt: dto.assessedAt ? iso(new Date(dto.assessedAt)) : nowIso(),
      ...this.compute(dto, student.heightCm),
      notes: dto.notes ?? null,
      measurements: dto.measurements ?? null,
      photos: [],
      createdAt: nowIso(),
    };
    db().assessments.push(a);
    this.afterCompleted(a, user);
    return this.serialize(a);
  },
  schedule(trainerId: string, dto: any) {
    access.assertTrainerCanAccessStudent(trainerId, dto.studentId);
    const a: DbAssessment = {
      id: uuid(),
      studentId: dto.studentId,
      trainerId,
      status: 'SCHEDULED',
      scheduledFor: iso(new Date(dto.scheduledFor)),
      assessedAt: null,
      weightKg: null,
      heightCm: null,
      bmi: null,
      bodyFatPct: null,
      muscleMassKg: null,
      leanMassKg: null,
      visceralFat: null,
      notes: dto.notes ?? null,
      measurements: null,
      photos: [],
      createdAt: nowIso(),
    };
    db().assessments.push(a);
    notify(studentById(dto.studentId)!.userId, {
      type: 'ASSESSMENT',
      title: 'Avaliação física agendada',
      body: `Sua avaliação física foi agendada para ${new Date(dto.scheduledFor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`,
      data: { assessmentId: a.id },
    });
    return this.serialize(a);
  },
  getOwned(user: AuthUser, id: string, write: boolean) {
    const a = byId(db().assessments, id);
    if (!a) throw notFound('Avaliação');
    access.resolveStudentId(user, a.studentId);
    if (write && user.role === 'STUDENT' && a.trainerId) throw forbidden('Somente o professor pode alterar esta avaliação');
    return a;
  },
  update(user: AuthUser, id: string, dto: any) {
    const a = this.getOwned(user, id, true);
    const student = studentById(a.studentId)!;
    const completing = dto.status === 'COMPLETED' || (a.status === 'SCHEDULED' && dto.weightKg !== undefined);
    const merged = {
      weightKg: dto.weightKg ?? a.weightKg ?? undefined,
      heightCm: dto.heightCm ?? a.heightCm ?? undefined,
      bodyFatPct: dto.bodyFatPct ?? a.bodyFatPct ?? undefined,
      muscleMassKg: dto.muscleMassKg ?? a.muscleMassKg ?? undefined,
      leanMassKg: dto.leanMassKg,
      visceralFat: dto.visceralFat ?? a.visceralFat ?? undefined,
    };
    Object.assign(a, this.compute(merged, student.heightCm));
    if (dto.notes !== undefined) a.notes = dto.notes;
    if (dto.scheduledFor) a.scheduledFor = iso(new Date(dto.scheduledFor));
    a.status = completing ? 'COMPLETED' : dto.status ?? a.status;
    if (dto.assessedAt) a.assessedAt = iso(new Date(dto.assessedAt));
    else if (completing && !a.assessedAt) a.assessedAt = nowIso();
    if (dto.measurements) a.measurements = { ...(a.measurements ?? {}), ...dto.measurements };
    if (a.status === 'COMPLETED') this.afterCompleted(a, user);
    return this.serialize(a);
  },
  list(user: AuthUser, studentIdParam?: string, status?: string) {
    const studentId = access.resolveStudentId(user, studentIdParam);
    return db()
      .assessments.filter((a) => a.studentId === studentId && (!status || a.status === status))
      .sort((a, b) => {
        if (!a.assessedAt && b.assessedAt) return -1;
        if (a.assessedAt && !b.assessedAt) return 1;
        return t(b.assessedAt) - t(a.assessedAt) || t(b.scheduledFor) - t(a.scheduledFor);
      })
      .map((a) => this.serialize(a));
  },
  get(user: AuthUser, id: string) {
    return this.serialize(this.getOwned(user, id, false));
  },
  remove(user: AuthUser, id: string) {
    this.getOwned(user, id, true);
    db().assessments = db().assessments.filter((a) => a.id !== id);
  },
  addPhoto(user: AuthUser, id: string, angle: string, url: string) {
    const a = this.getOwned(user, id, true);
    const existing = a.photos.find((p) => p.angle === angle);
    if (existing) existing.url = url;
    else a.photos.push({ id: uuid(), angle, url });
    return this.get(user, id);
  },
  compare(user: AuthUser, beforeId: string, afterId: string) {
    const before = this.getOwned(user, beforeId, false);
    const after = this.getOwned(user, afterId, false);
    if (before.studentId !== after.studentId) throw forbidden('As avaliações devem ser do mesmo aluno');
    const a = this.serialize(before);
    const b = this.serialize(after);
    const diff = (x: number | null, y: number | null) => (x !== null && y !== null ? round(y - x, 1) : null);
    return {
      before: a,
      after: b,
      deltas: {
        weightKg: diff(a.weightKg, b.weightKg),
        bmi: diff(a.bmi, b.bmi),
        bodyFatPct: diff(a.bodyFatPct, b.bodyFatPct),
        muscleMassKg: diff(a.muscleMassKg, b.muscleMassKg),
        leanMassKg: diff(a.leanMassKg, b.leanMassKg),
        visceralFat: diff(a.visceralFat, b.visceralFat),
        measurements: Object.fromEntries(
          BODY_MEASUREMENT_KEYS.map((k) => [k, diff((a.measurements as any)?.[k] ?? null, (b.measurements as any)?.[k] ?? null)]),
        ),
      },
      photos: ['FRONT', 'BACK', 'RIGHT', 'LEFT'].map((angle) => ({
        angle,
        before: a.photos.find((p) => p.angle === angle)?.url ?? null,
        after: b.photos.find((p) => p.angle === angle)?.url ?? null,
      })),
    };
  },
  afterCompleted(a: DbAssessment, user: AuthUser) {
    const latest = db()
      .assessments.filter((x) => x.studentId === a.studentId && x.status === 'COMPLETED' && x.weightKg !== null)
      .sort((x, y) => t(y.assessedAt) - t(x.assessedAt))[0];
    const student = studentById(a.studentId)!;
    if (latest) {
      student.currentWeightKg = latest.weightKg;
      if (latest.heightCm !== null) student.heightCm = latest.heightCm;
      if (student.initialWeightKg === null) student.initialWeightKg = latest.weightKg;
    }
    goals.refreshForStudent(student.id);
    if (user.role === 'TRAINER') {
      notify(student.userId, {
        type: 'ASSESSMENT',
        title: 'Nova avaliação física',
        body: 'Seu professor registrou uma nova avaliação física. Confira sua evolução!',
        data: { assessmentId: a.id },
      });
    }
  },
};

// ---------------------------------------------------------------------------
// Metas
// ---------------------------------------------------------------------------

const UNITS: Record<string, string> = {
  BODY_WEIGHT: 'kg',
  BODY_FAT: '%',
  WEEKLY_FREQUENCY: 'treinos/semana',
  EXERCISE_LOAD: 'kg',
  CUSTOM: '',
};

export const goals = {
  serialize(g: DbGoal) {
    const values = { startValue: g.startValue, currentValue: g.currentValue, targetValue: g.targetValue };
    return { ...g, ...values, progressPct: goalProgress(values), exerciseName: byId(db().exercises, g.exerciseId)?.name ?? null };
  },
  list(user: AuthUser, studentIdParam?: string, status?: string) {
    const studentId = access.resolveStudentId(user, studentIdParam);
    this.refreshForStudent(studentId, { notify: false });
    const order = ['ACTIVE', 'ACHIEVED', 'CANCELED'];
    return db()
      .goals.filter((g) => g.studentId === studentId && (!status || g.status === status))
      .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || t(b.createdAt) - t(a.createdAt))
      .map((g) => this.serialize(g));
  },
  create(trainerId: string, dto: any) {
    access.assertTrainerCanAccessStudent(trainerId, dto.studentId);
    if (dto.type === 'EXERCISE_LOAD' && !dto.exerciseId) throw domain('Informe o exercício da meta de carga', 'EXERCISE_REQUIRED');
    if (dto.type === 'CUSTOM' && !(dto.title && dto.unit)) throw domain('Metas personalizadas exigem título e unidade', 'TITLE_REQUIRED');
    const measured = this.measure(dto.studentId, dto.type, dto.exerciseId);
    const startValue = dto.startValue ?? measured ?? 0;
    const exercise = dto.exerciseId ? byId(db().exercises, dto.exerciseId) : null;
    if (dto.exerciseId && !exercise) throw notFound('Exercício');
    const now = nowIso();
    const g: DbGoal = {
      id: uuid(),
      studentId: dto.studentId,
      trainerId,
      type: dto.type,
      exerciseId: dto.exerciseId ?? null,
      title: dto.title ?? this.defaultTitle(dto.type, Number(dto.targetValue), startValue, exercise?.name),
      unit: dto.unit ?? UNITS[dto.type] ?? '',
      startValue,
      currentValue: measured ?? startValue,
      targetValue: Number(dto.targetValue),
      deadline: dto.deadline ? iso(new Date(dto.deadline)) : null,
      status: 'ACTIVE',
      achievedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    db().goals.push(g);
    notify(studentById(dto.studentId)!.userId, {
      type: 'GOAL',
      title: 'Nova meta',
      body: `Seu professor definiu uma nova meta: ${g.title}.`,
      data: { goalId: g.id },
    });
    return this.serialize(g);
  },
  update(trainerId: string, id: string, dto: any) {
    const g = db().goals.find((x) => x.id === id && x.trainerId === trainerId);
    if (!g) throw notFound('Meta');
    access.assertTrainerCanAccessStudent(trainerId, g.studentId);
    if (dto.title !== undefined) g.title = dto.title;
    if (dto.targetValue !== undefined) g.targetValue = Number(dto.targetValue);
    if (dto.currentValue !== undefined) g.currentValue = Number(dto.currentValue);
    if (dto.deadline) g.deadline = iso(new Date(dto.deadline));
    if (dto.status) g.status = dto.status;
    if (dto.status === 'ACHIEVED') g.achievedAt = nowIso();
    g.updatedAt = nowIso();
    this.refreshForStudent(g.studentId);
    return this.serialize(g);
  },
  remove(trainerId: string, id: string) {
    const before = db().goals.length;
    db().goals = db().goals.filter((g) => !(g.id === id && g.trainerId === trainerId));
    if (db().goals.length === before) throw notFound('Meta');
  },
  measure(studentId: string, type: string, exerciseId?: string | null): number | null {
    switch (type) {
      case 'BODY_WEIGHT':
        return studentById(studentId)?.currentWeightKg ?? null;
      case 'BODY_FAT':
        return (
          db()
            .assessments.filter((a) => a.studentId === studentId && a.status === 'COMPLETED' && a.bodyFatPct !== null)
            .sort((a, b) => t(b.assessedAt) - t(a.assessedAt))[0]?.bodyFatPct ?? null
        );
      case 'WEEKLY_FREQUENCY': {
        const ws = startOfWeek(new Date()).getTime();
        return completedSessions(studentId).filter((s) => t(s.startedAt) >= ws).length;
      }
      case 'EXERCISE_LOAD': {
        if (!exerciseId) return null;
        const ids = new Set(db().sessions.filter((s) => s.studentId === studentId).map((s) => s.id));
        const loads = db()
          .sets.filter((s) => s.exerciseId === exerciseId && ids.has(s.sessionId))
          .map((s) => s.loadKg);
        return loads.length ? Math.max(...loads) : null;
      }
      default:
        return null;
    }
  },
  refreshForStudent(studentId: string, opts: { notify?: boolean } = {}) {
    for (const g of db().goals.filter((x) => x.studentId === studentId && x.status === 'ACTIVE')) {
      const measured = g.type === 'CUSTOM' ? null : this.measure(studentId, g.type, g.exerciseId);
      const currentValue = measured ?? g.currentValue;
      const pct = goalProgress({ startValue: g.startValue, currentValue, targetValue: g.targetValue });
      const achieved = pct >= 100 && g.type !== 'WEEKLY_FREQUENCY';
      if (currentValue === g.currentValue && !achieved) continue;
      g.currentValue = currentValue;
      if (achieved) {
        g.status = 'ACHIEVED';
        g.achievedAt = nowIso();
        if (opts.notify !== false) {
          const su = studentUser(studentId);
          notify(su.id, { type: 'GOAL', title: 'Meta alcançada! 🎉', body: `Parabéns! Você alcançou a meta: ${g.title}.`, data: { goalId: g.id } });
          if (g.trainerId && trainerById(g.trainerId)) {
            notify(trainerById(g.trainerId)!.userId, {
              type: 'GOAL',
              title: 'Meta alcançada',
              body: `${su.name} alcançou a meta: ${g.title}.`,
              data: { goalId: g.id, studentId },
            });
          }
        }
      }
    }
  },
  defaultTitle(type: string, target: number, start: number, exerciseName?: string) {
    const fmt = (n: number) => n.toLocaleString('pt-BR');
    switch (type) {
      case 'BODY_WEIGHT':
        return `Chegar a ${fmt(target)} kg`;
      case 'BODY_FAT':
        return target < start ? `Reduzir gordura corporal para ${fmt(target)}%` : `Gordura corporal em ${fmt(target)}%`;
      case 'WEEKLY_FREQUENCY':
        return `Treinar ${fmt(target)} vezes por semana`;
      case 'EXERCISE_LOAD':
        return `${exerciseName ?? 'Exercício'} ${fmt(target)} kg`;
      default:
        return 'Meta personalizada';
    }
  },
};

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

const BUSY = ['REQUESTED', 'CONFIRMED'];

export const schedule = {
  serialize(a: DbAppointment) {
    const tu = trainerUser(a.trainerId);
    const su = a.studentId ? studentUser(a.studentId) : null;
    return {
      id: a.id,
      status: a.status,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      location: a.location,
      notes: a.notes,
      cancelReason: a.cancelReason,
      trainer: { id: a.trainerId, name: tu.name, avatarUrl: tu.avatarUrl },
      student: su ? { id: a.studentId, name: su.name, avatarUrl: su.avatarUrl } : null,
    };
  },
  list(user: AuthUser, from: Date, to: Date) {
    const inRange = (a: DbAppointment) => t(a.startsAt) >= from.getTime() && t(a.startsAt) < to.getTime();
    let items: DbAppointment[];
    if (user.role === 'TRAINER') items = db().appointments.filter((a) => a.trainerId === user.trainerId && inRange(a));
    else {
      const trainerIds = db()
        .links.filter((l) => l.studentId === user.studentId && l.status === 'ACTIVE')
        .map((l) => l.trainerId);
      const min = Math.max(Date.now(), from.getTime());
      items = db().appointments.filter(
        (a) =>
          inRange(a) &&
          (a.studentId === user.studentId || (trainerIds.includes(a.trainerId) && a.status === 'AVAILABLE' && t(a.startsAt) >= min)),
      );
    }
    return items.sort((a, b) => t(a.startsAt) - t(b.startsAt)).map((a) => this.serialize(a));
  },
  range(startIso: string, endIso: string) {
    const startsAt = new Date(startIso);
    const endsAt = new Date(endIso);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw domain('Datas inválidas', 'INVALID_TIME_RANGE');
    if (endsAt <= startsAt) throw domain('O horário final deve ser após o inicial', 'INVALID_TIME_RANGE');
    if (endsAt.getTime() - startsAt.getTime() > 12 * 3600_000) throw domain('Período muito longo', 'INVALID_TIME_RANGE');
    return { startsAt, endsAt };
  },
  hasConflict(trainerId: string, s: Date, e: Date, excludeId: string | null, includeAvailable: boolean, statuses = BUSY) {
    const st = includeAvailable ? [...statuses, 'AVAILABLE'] : statuses;
    return db().appointments.some(
      (a) => a.trainerId === trainerId && a.id !== excludeId && st.includes(a.status) && t(a.startsAt) < e.getTime() && t(a.endsAt) > s.getTime(),
    );
  },
  assertFree(trainerId: string, s: Date, e: Date, excludeId: string | null, includeAvailable: boolean, statuses = BUSY) {
    if (this.hasConflict(trainerId, s, e, excludeId, includeAvailable, statuses)) throw conflict('Conflito de horário na agenda do professor');
  },
  newAppointment(data: Partial<DbAppointment> & { trainerId: string; startsAt: string; endsAt: string; status: DbAppointment['status'] }): DbAppointment {
    const a: DbAppointment = {
      id: uuid(),
      studentId: null,
      requestedById: null,
      location: null,
      notes: null,
      cancelReason: null,
      createdAt: nowIso(),
      ...data,
    };
    db().appointments.push(a);
    return a;
  },
  notifyUser(userId: string, title: string, body: string, appointmentId: string) {
    notify(userId, { type: 'APPOINTMENT', title, body, data: { appointmentId } });
  },
  create(trainerId: string, dto: any) {
    const { startsAt, endsAt } = this.range(dto.startsAt, dto.endsAt);
    if (dto.studentId) access.assertTrainerCanAccessStudent(trainerId, dto.studentId);
    this.assertFree(trainerId, startsAt, endsAt, null, !dto.studentId);
    const a = this.newAppointment({
      trainerId,
      studentId: dto.studentId || null,
      startsAt: iso(startsAt),
      endsAt: iso(endsAt),
      location: dto.location ?? null,
      notes: dto.notes ?? null,
      status: dto.studentId ? 'CONFIRMED' : 'AVAILABLE',
    });
    if (a.studentId) this.notifyUser(studentUser(a.studentId).id, 'Treino agendado', `Seu professor agendou um treino para ${fmtSP(startsAt)}.`, a.id);
    return this.serialize(a);
  },
  createSlots(trainerId: string, dto: any) {
    const { startsAt, endsAt } = this.range(dto.startsAt, dto.endsAt);
    const dur = Number(dto.durationMinutes) * 60_000;
    if (!(dur >= 15 * 60_000 && dur <= 240 * 60_000)) throw domain('Duração inválida');
    const created: DbAppointment[] = [];
    for (let x = startsAt.getTime(); x + dur <= endsAt.getTime(); x += dur) {
      if (created.length >= 48) break;
      const s = new Date(x);
      const e = new Date(x + dur);
      if (this.hasConflict(trainerId, s, e, null, true)) continue;
      created.push(this.newAppointment({ trainerId, startsAt: iso(s), endsAt: iso(e), location: dto.location ?? null, status: 'AVAILABLE' }));
    }
    return created.map((a) => this.serialize(a));
  },
  book(studentId: string, id: string, notes?: string) {
    const slot = byId(db().appointments, id);
    if (!slot || slot.status !== 'AVAILABLE') throw notFound('Horário disponível');
    access.assertTrainerCanAccessStudent(slot.trainerId, studentId);
    if (t(slot.startsAt) < Date.now()) throw domain('Este horário já passou', 'PAST_SLOT');
    Object.assign(slot, { status: 'REQUESTED', studentId, requestedById: studentById(studentId)!.userId, notes: notes ?? slot.notes });
    this.notifyUser(trainerUser(slot.trainerId).id, 'Solicitação de horário', `${studentUser(studentId).name} solicitou o horário de ${fmtSP(new Date(slot.startsAt))}.`, id);
    return this.serialize(slot);
  },
  request(user: AuthUser, dto: any) {
    const studentId = access.requireStudent(user);
    const trainerId = dto.trainerId ?? access.primaryLinkForStudent(studentId)?.trainerId;
    if (!trainerId) throw domain('Você ainda não está vinculado a um professor', 'NO_TRAINER');
    access.assertTrainerCanAccessStudent(trainerId, studentId);
    const { startsAt, endsAt } = this.range(dto.startsAt, dto.endsAt);
    if (startsAt.getTime() < Date.now()) throw domain('Escolha um horário futuro', 'PAST_SLOT');
    this.assertFree(trainerId, startsAt, endsAt, null, false);
    const a = this.newAppointment({
      trainerId,
      studentId,
      requestedById: user.userId,
      startsAt: iso(startsAt),
      endsAt: iso(endsAt),
      notes: dto.notes ?? null,
      status: 'REQUESTED',
    });
    this.notifyUser(trainerUser(trainerId).id, 'Solicitação de horário', `${studentUser(studentId).name} solicitou um treino em ${fmtSP(startsAt)}.`, a.id);
    return this.serialize(a);
  },
  getForTrainer(trainerId: string, id: string) {
    const a = db().appointments.find((x) => x.id === id && x.trainerId === trainerId);
    if (!a) throw notFound('Agendamento');
    return a;
  },
  getForUser(user: AuthUser, id: string) {
    if (user.role === 'TRAINER') return this.getForTrainer(user.trainerId!, id);
    if (user.role !== 'STUDENT') throw forbidden();
    const a = db().appointments.find((x) => x.id === id && x.studentId === user.studentId);
    if (!a) throw notFound('Agendamento');
    return a;
  },
  confirm(trainerId: string, id: string) {
    const a = this.getForTrainer(trainerId, id);
    if (a.status !== 'REQUESTED') throw conflict('Somente solicitações podem ser confirmadas');
    this.assertFree(trainerId, new Date(a.startsAt), new Date(a.endsAt), id, false, ['CONFIRMED']);
    a.status = 'CONFIRMED';
    if (a.studentId) this.notifyUser(studentUser(a.studentId).id, 'Horário confirmado', `Seu treino de ${fmtSP(new Date(a.startsAt))} foi confirmado.`, id);
    return this.serialize(a);
  },
  reschedule(user: AuthUser, id: string, dto: any) {
    const a = this.getForUser(user, id);
    if (a.status === 'CANCELED' || a.status === 'COMPLETED') throw conflict('Agendamento encerrado');
    const { startsAt, endsAt } = this.range(dto.startsAt, dto.endsAt);
    this.assertFree(a.trainerId, startsAt, endsAt, id, a.status === 'AVAILABLE');
    const byStudent = user.role === 'STUDENT';
    if (byStudent && a.status === 'CONFIRMED') a.status = 'REQUESTED';
    a.startsAt = iso(startsAt);
    a.endsAt = iso(endsAt);
    if (byStudent) {
      this.notifyUser(trainerUser(a.trainerId).id, 'Pedido de reagendamento', `${studentUser(a.studentId!).name} pediu para reagendar para ${fmtSP(startsAt)}.`, id);
    } else if (a.studentId) {
      this.notifyUser(studentUser(a.studentId).id, 'Treino reagendado', `Seu treino foi reagendado para ${fmtSP(startsAt)}.`, id);
    }
    return this.serialize(a);
  },
  cancel(user: AuthUser, id: string, reason?: string) {
    const a = this.getForUser(user, id);
    if (a.status === 'CANCELED' || a.status === 'COMPLETED') throw conflict('Agendamento encerrado');
    a.status = 'CANCELED';
    a.cancelReason = reason ?? null;
    const reasonText = reason ? ` Motivo: ${reason}` : '';
    const when = fmtSP(new Date(a.startsAt));
    if (user.role === 'STUDENT') {
      this.notifyUser(trainerUser(a.trainerId).id, 'Treino cancelado', `${studentUser(a.studentId!).name} cancelou o treino de ${when}.${reasonText}`, id);
    } else if (a.studentId) {
      this.notifyUser(studentUser(a.studentId).id, 'Treino cancelado', `Seu treino de ${when} foi cancelado.${reasonText}`, id);
    }
    return this.serialize(a);
  },
  complete(trainerId: string, id: string) {
    const a = this.getForTrainer(trainerId, id);
    if (a.status !== 'CONFIRMED') throw conflict('Somente agendamentos confirmados podem ser concluídos');
    a.status = 'COMPLETED';
    return this.serialize(a);
  },
  remove(trainerId: string, id: string) {
    const a = this.getForTrainer(trainerId, id);
    if (a.status !== 'AVAILABLE') throw conflict('Cancele o agendamento em vez de excluí-lo');
    db().appointments = db().appointments.filter((x) => x.id !== id);
  },
};

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

const PREVIEW: Record<string, string> = { TEXT: '', IMAGE: '📷 Foto', VIDEO: '🎬 Vídeo', AUDIO: '🎤 Áudio', FILE: '📎 Arquivo' };
export const typeFromMime = (mime: string): DbMessage['type'] =>
  mime.startsWith('image/') ? 'IMAGE' : mime.startsWith('video/') ? 'VIDEO' : mime.startsWith('audio/') ? 'AUDIO' : 'FILE';

export const chat = {
  conversations(user: AuthUser) {
    const links = db().links.filter(
      (l) => l.status !== 'INACTIVE' && (user.role === 'TRAINER' ? l.trainerId === user.trainerId : l.studentId === (user.studentId ?? '')),
    );
    return links
      .map((l) => {
        const msgs = db()
          .messages.filter((m) => m.trainerStudentId === l.id)
          .sort((a, b) => t(b.createdAt) - t(a.createdAt));
        const other = user.role === 'TRAINER' ? studentUser(l.studentId) : trainerUser(l.trainerId);
        return {
          id: l.id,
          trainerId: l.trainerId,
          studentId: l.studentId,
          participant: { userId: other.id, name: other.name, avatarUrl: other.avatarUrl },
          lastMessage: msgs[0] ?? null,
          unreadCount: msgs.filter((m) => m.senderId !== user.userId && !m.readAt).length,
        };
      })
      .sort((a, b) => t(b.lastMessage?.createdAt) - t(a.lastMessage?.createdAt));
  },
  messages(user: AuthUser, conversationId: string, before?: string, limit = 30) {
    access.assertConversationMember(user, conversationId);
    return db()
      .messages.filter((m) => m.trainerStudentId === conversationId && (!before || t(m.createdAt) < t(before)))
      .sort((a, b) => t(b.createdAt) - t(a.createdAt) || b.id.localeCompare(a.id))
      .slice(0, Math.min(limit, 100))
      .reverse();
  },
  send(user: AuthUser, conversationId: string, input: any) {
    const link = access.assertConversationMember(user, conversationId);
    if (link.status === 'INACTIVE') throw domain('Este acompanhamento está inativo', 'INACTIVE_LINK');
    const type = input.type ?? 'TEXT';
    if (type === 'TEXT' && !String(input.content ?? '').trim()) throw domain('Mensagem vazia', 'EMPTY_MESSAGE');
    if (type !== 'TEXT' && !input.attachmentUrl) throw domain('Anexo obrigatório', 'ATTACHMENT_REQUIRED');
    const m: DbMessage = {
      id: uuid(),
      trainerStudentId: conversationId,
      senderId: user.userId,
      type,
      content: input.content ? String(input.content).trim() : null,
      attachmentUrl: input.attachmentUrl ?? null,
      attachmentName: input.attachmentName ?? null,
      attachmentMime: input.attachmentMime ?? null,
      isQuestion: input.isQuestion ?? false,
      readAt: null,
      createdAt: nowIso(),
    };
    db().messages.push(m);
    const sender = userOf(user.userId);
    const out = { ...m, sender: { name: sender.name } };
    publishRealtime({ type: 'message', conversationId, payload: out });
    const recipient = user.role === 'TRAINER' ? studentUser(link.studentId) : trainerUser(link.trainerId);
    const preview = (m.content ?? '') || PREVIEW[type];
    notify(recipient.id, {
      type: 'MESSAGE',
      title: m.isQuestion ? `Dúvida de ${sender.name}` : sender.name,
      body: preview.length > 120 ? `${preview.slice(0, 117)}...` : preview,
      data: { conversationId, messageId: m.id },
    });
    return out;
  },
  markRead(user: AuthUser, conversationId: string) {
    access.assertConversationMember(user, conversationId);
    let count = 0;
    const now = nowIso();
    db().messages.forEach((m) => {
      if (m.trainerStudentId === conversationId && m.senderId !== user.userId && !m.readAt) {
        m.readAt = now;
        count++;
      }
    });
    if (count) publishRealtime({ type: 'read', conversationId, payload: { conversationId, readerId: user.userId, at: now } });
    return { updated: count };
  },
  askQuestion(user: AuthUser, content: string) {
    const studentId = access.requireStudent(user);
    const link = access.primaryLinkForStudent(studentId);
    if (!link) throw domain('Você ainda não está vinculado a um professor', 'NO_TRAINER');
    return this.send(user, link.id, { type: 'TEXT', content, isQuestion: true });
  },
};

// ---------------------------------------------------------------------------
// Anotações privadas
// ---------------------------------------------------------------------------

export const notes = {
  list(trainerId: string, studentId: string) {
    access.assertTrainerHasLink(trainerId, studentId);
    return db()
      .notes.filter((n) => n.trainerId === trainerId && n.studentId === studentId)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || t(b.createdAt) - t(a.createdAt));
  },
  create(trainerId: string, studentId: string, content: string, pinned = false) {
    access.assertTrainerHasLink(trainerId, studentId);
    if (!String(content ?? '').trim()) throw domain('Anotação vazia');
    const now = nowIso();
    const n = { id: uuid(), trainerId, studentId, content: String(content).trim(), pinned: Boolean(pinned), createdAt: now, updatedAt: now };
    db().notes.push(n);
    return n;
  },
  own(trainerId: string, id: string) {
    const n = db().notes.find((x) => x.id === id && x.trainerId === trainerId);
    if (!n) throw notFound('Anotação');
    return n;
  },
  update(trainerId: string, id: string, data: any) {
    const n = this.own(trainerId, id);
    if (data.content) n.content = String(data.content).trim();
    if (data.pinned !== undefined) n.pinned = Boolean(data.pinned);
    n.updatedAt = nowIso();
    return n;
  },
  remove(trainerId: string, id: string) {
    this.own(trainerId, id);
    db().notes = db().notes.filter((n) => n.id !== id);
  },
};

// ---------------------------------------------------------------------------
// IA (motor de regras — a IA sugere, o professor decide)
// ---------------------------------------------------------------------------

export const ai = {
  list(trainerId: string, status?: string, studentId?: string) {
    return db()
      .aiSuggestions.filter((s) => s.trainerId === trainerId && (!status || s.status === status) && (!studentId || s.studentId === studentId))
      .sort((a, b) => t(b.createdAt) - t(a.createdAt))
      .slice(0, 100)
      .map((s) => {
        const su = studentUser(s.studentId);
        return { ...s, student: { ...studentById(s.studentId)!, user: { name: su.name, avatarUrl: su.avatarUrl } } };
      });
  },
  buildDrafts(trainerId: string, studentId: string, opts: { skipStagnation?: boolean } = {}): SuggestionDraft[] {
    const drafts: SuggestionDraft[] = [];
    const d = db();
    const student = studentById(studentId)!;
    const assignments = workouts.activeAssignments(studentId, trainerId);
    const since = addDays(new Date(), -120).getTime();
    const sess = completedSessions(studentId).filter((s) => t(s.startedAt) >= since);
    for (const a of assignments) {
      for (const we of d.workoutExercises.filter((x) => x.workoutId === a.workoutId)) {
        const ex = byId(d.exercises, we.exerciseId)!;
        const history: ExerciseSessionHistory = {
          workoutExerciseId: we.id,
          exerciseName: ex.name,
          targetReps: parseTargetReps(we.reps),
          currentSuggestedLoadKg: we.suggestedLoadKg,
          sessions: sess
            .map((s) => ({
              date: s.startedAt,
              sets: d.sets.filter((x) => x.sessionId === s.id && x.exerciseId === we.exerciseId).map((x) => ({ loadKg: x.loadKg, reps: x.reps, rpe: x.rpe })),
            }))
            .filter((s) => s.sets.length > 0),
        };
        const progression = suggestLoadProgression(history);
        if (progression && (we.suggestedLoadKg ?? 0) < (progression.payload.suggestedLoadKg as number)) drafts.push(progression);
        if (!opts.skipStagnation) {
          const stagnation = detectStagnation(history);
          if (stagnation) drafts.push(stagnation);
        }
      }
    }
    const twoWeeksAgo = addDays(new Date(), -14).getTime();
    const low = detectLowFrequency({
      studentName: userOf(student.userId).name,
      sessionsLastTwoWeeks: sess.filter((s) => t(s.startedAt) >= twoWeeksAgo).length,
      plannedPerWeek: student.weeklyFrequency,
      daysSinceLastWorkout: daysSinceLastWorkout(sess[0]?.startedAt ?? null),
    });
    if (low && assignments.length) drafts.push(low);
    return drafts;
  },
  isDuplicate(trainerId: string, studentId: string, draft: SuggestionDraft) {
    const weId = draft.payload.workoutExerciseId as string | undefined;
    const weekAgo = addDays(new Date(), -7).getTime();
    return db()
      .aiSuggestions.filter(
        (s) => s.trainerId === trainerId && s.studentId === studentId && s.type === draft.type && (s.status === 'PENDING' || t(s.createdAt) >= weekAgo),
      )
      .some((s) => !weId || s.payload.workoutExerciseId === weId);
  },
  analyzeStudent(trainerId: string, studentId: string, opts: { notify?: boolean; skipStagnation?: boolean; at?: string } = {}) {
    access.assertTrainerCanAccessStudent(trainerId, studentId);
    const created = [];
    for (const draft of this.buildDrafts(trainerId, studentId, opts)) {
      if (this.isDuplicate(trainerId, studentId, draft)) continue;
      const s = {
        id: uuid(),
        trainerId,
        studentId,
        type: draft.type,
        title: draft.title,
        content: draft.content,
        payload: draft.payload,
        source: 'rules',
        status: 'PENDING' as const,
        reviewedAt: null,
        createdAt: opts.at ?? nowIso(),
      };
      db().aiSuggestions.push(s);
      created.push(s);
    }
    if (created.length && opts.notify !== false) {
      notify(trainerById(trainerId)!.userId, {
        type: 'AI_SUGGESTION',
        title: 'Novas sugestões da IA',
        body: `${created.length} sugestão(ões) aguardando sua aprovação.`,
        dedupeKey: `ai:${toDateKey(new Date())}:${studentId}`,
      });
    }
    return created;
  },
  analyzeTrainer(trainerId: string) {
    const links = db().links.filter((l) => l.trainerId === trainerId && l.status === 'ACTIVE');
    let total = 0;
    for (const l of links) total += this.analyzeStudent(trainerId, l.studentId, { notify: false }).length;
    if (total) {
      notify(trainerById(trainerId)!.userId, {
        type: 'AI_SUGGESTION',
        title: 'Novas sugestões da IA',
        body: `${total} sugestão(ões) para seus alunos aguardando aprovação.`,
        dedupeKey: `ai:${toDateKey(new Date())}`,
      });
    }
    return { students: links.length, suggestions: total };
  },
  pending(trainerId: string, id: string) {
    const s = db().aiSuggestions.find((x) => x.id === id && x.trainerId === trainerId);
    if (!s) throw notFound('Sugestão');
    if (s.status !== 'PENDING') throw conflict('Sugestão já revisada');
    return s;
  },
  approve(trainerId: string, id: string) {
    const s = this.pending(trainerId, id);
    if (s.type === 'LOAD_PROGRESSION') {
      const payload = s.payload as { workoutExerciseId?: string; suggestedLoadKg?: number };
      const we = db().workoutExercises.find((x) => x.id === payload.workoutExerciseId && byId(db().workouts, x.workoutId)?.trainerId === trainerId);
      if (!we || typeof payload.suggestedLoadKg !== 'number') throw notFound('Exercício da ficha');
      we.suggestedLoadKg = payload.suggestedLoadKg;
      s.status = 'APPLIED';
      s.reviewedAt = nowIso();
      notify(studentById(s.studentId)!.userId, {
        type: 'WORKOUT_UPDATED',
        title: 'Treino atualizado',
        body: `Seu professor atualizou seu treino: ${byId(db().exercises, we.exerciseId)!.name} agora com ${payload.suggestedLoadKg} kg.`,
        data: { workoutId: we.workoutId },
      });
      return s;
    }
    s.status = 'APPROVED';
    s.reviewedAt = nowIso();
    return s;
  },
  reject(trainerId: string, id: string) {
    const s = this.pending(trainerId, id);
    s.status = 'REJECTED';
    s.reviewedAt = nowIso();
    return s;
  },
};

// ---------------------------------------------------------------------------
// Relatórios semanais
// ---------------------------------------------------------------------------

export const reports = {
  list(user: AuthUser, studentIdParam?: string) {
    const studentId = access.resolveStudentId(user, studentIdParam);
    return db()
      .reports.filter((r) => r.studentId === studentId && (user.role !== 'TRAINER' || r.trainerId === user.trainerId))
      .sort((a, b) => t(b.weekStart) - t(a.weekStart))
      .slice(0, 52);
  },
  generate(trainerId: string, studentId: string, weekStartIso?: string) {
    access.assertTrainerHasLink(trainerId, studentId);
    const d = db();
    const weekStart = startOfWeek(weekStartIso ? new Date(weekStartIso) : addDays(new Date(), -7));
    const weekEnd = addDays(weekStart, 7);
    const prevStart = addDays(weekStart, -7);
    const student = studentById(studentId)!;
    const done = d.sessions.filter((s) => s.studentId === studentId && s.status === 'COMPLETED');
    const inRange = (s: { startedAt: string }, a: Date, b: Date) => t(s.startedAt) >= a.getTime() && t(s.startedAt) < b.getTime();
    const weekSessions = done.filter((s) => inRange(s, weekStart, weekEnd));
    const prevSessions = done.filter((s) => inRange(s, prevStart, weekStart));
    const setsOf = (ids: string[]) => d.sets.filter((x) => ids.includes(x.sessionId));
    const weekSets = setsOf(weekSessions.map((s) => s.id));
    const exerciseIds = [...new Set(weekSets.map((s) => s.exerciseId))];
    const previousSets = setsOf(done.filter((s) => t(s.startedAt) < weekStart.getTime()).map((s) => s.id));
    const exs = exerciseIds.map((id) => {
      const current = bestSet(weekSets.filter((s) => s.exerciseId === id));
      const previous = bestSet(previousSets.filter((s) => s.exerciseId === id));
      return { name: byId(d.exercises, id)!.name, previousBestKg: previous?.loadKg ?? null, currentBestKg: current?.loadKg ?? 0 };
    });
    const assess = d.assessments
      .filter((a) => a.studentId === studentId && a.status === 'COMPLETED' && a.weightKg !== null && t(a.assessedAt) < weekEnd.getTime())
      .sort((a, b) => t(a.assessedAt) - t(b.assessedAt));
    const before = assess.filter((a) => t(a.assessedAt) < weekStart.getTime()).pop();
    const inWeek = assess.filter((a) => t(a.assessedAt) >= weekStart.getTime());
    const { data, summary } = buildWeeklyReport({
      studentName: userOf(student.userId).name,
      weekStart: toDateKey(weekStart),
      sessionsCount: weekSessions.length,
      plannedPerWeek: student.weeklyFrequency,
      totalVolumeKg: totalVolume(weekSets),
      previousWeekVolumeKg: totalVolume(setsOf(prevSessions.map((s) => s.id))),
      totalDurationSeconds: weekSessions.reduce((acc, s) => acc + (s.durationSeconds ?? 0), 0),
      weightStartKg: (before ?? inWeek[0])?.weightKg ?? null,
      weightEndKg: inWeek.length ? inWeek[inWeek.length - 1].weightKg : null,
      exercises: exs,
      personalRecords: weekSets.filter((s) => s.isPersonalRecord).length,
    });
    const payload = { ...data, aiNarrative: null };
    let report = d.reports.find((r) => r.studentId === studentId && r.trainerId === trainerId && t(r.weekStart) === weekStart.getTime());
    if (report) Object.assign(report, { summary, data: payload });
    else {
      report = { id: uuid(), studentId, trainerId, weekStart: iso(weekStart), summary, data: payload, createdAt: nowIso() };
      d.reports.push(report);
    }
    return report;
  },
};

// ---------------------------------------------------------------------------
// Dashboards
// ---------------------------------------------------------------------------

export const dashboard = {
  trainer(trainerId: string) {
    const d = db();
    const now = new Date();
    const todayStart = startOfDay(now).getTime();
    const todayEnd = endOfDay(now).getTime();
    const fourWeeksAgo = addDays(startOfWeek(now), -21).getTime();
    const links = d.links.filter((l) => l.trainerId === trainerId);
    const active = links.filter((l) => l.status === 'ACTIVE');
    const activeIds = active.map((l) => l.studentId);
    const card = (studentId: string) => {
      const u = studentUser(studentId);
      return { id: studentId, name: u.name, avatarUrl: u.avatarUrl };
    };
    const done = d.sessions.filter((s) => activeIds.includes(s.studentId) && s.status === 'COMPLETED');
    const inactive = active
      .map((l) => {
        const last = done.filter((s) => s.studentId === l.studentId).sort((a, b) => t(b.startedAt) - t(a.startedAt))[0]?.startedAt ?? null;
        return { ...card(l.studentId), lastWorkoutAt: last, daysWithoutTraining: daysSinceLastWorkout(last, now) };
      })
      .filter((s) => s.daysWithoutTraining === null || s.daysWithoutTraining >= INACTIVITY_THRESHOLD_DAYS)
      .sort((a, b) => (b.daysWithoutTraining ?? 999) - (a.daysWithoutTraining ?? 999));
    const plannedPerWeek = active.reduce((acc, l) => acc + studentById(l.studentId)!.weeklyFrequency, 0);
    const weightDeltas = active
      .map((l) => {
        const s = studentById(l.studentId)!;
        return s.initialWeightKg !== null && s.currentWeightKg !== null ? s.currentWeightKg - s.initialWeightKg : null;
      })
      .filter((x): x is number => x !== null);
    const scheduled = d.assessments
      .filter((a) => a.trainerId === trainerId && a.status === 'SCHEDULED')
      .sort((a, b) => t(a.scheduledFor) - t(b.scheduledFor));
    const needsAssessment = active.filter((l) => {
      const last = d.assessments
        .filter((a) => a.studentId === l.studentId && a.status === 'COMPLETED')
        .sort((a, b) => t(b.assessedAt) - t(a.assessedAt))[0]?.assessedAt;
      return !last || t(last) < addDays(now, -90).getTime();
    });
    const goalsNear = d.goals
      .filter((g) => activeIds.includes(g.studentId) && g.status === 'ACTIVE')
      .map((g) => {
        const values = { startValue: g.startValue, currentValue: g.currentValue, targetValue: g.targetValue };
        return { id: g.id, title: g.title, progressPct: goalProgress(values), near: isGoalNear(values), student: card(g.studentId) };
      })
      .filter((g) => g.near)
      .sort((a, b) => b.progressPct - a.progressPct)
      .map(({ near: _n, ...g }) => g);
    const linkIds = new Set(links.map((l) => l.id));
    const trainerUserId = trainerById(trainerId)!.userId;
    const sub = subscriptions.withPlan(trainerId);
    return {
      activeStudents: active.length,
      inactiveLinks: links.filter((l) => l.status === 'INACTIVE').length,
      newStudents: links.filter((l) => t(l.startedAt) >= addDays(now, -30).getTime()).map((l) => card(l.studentId)),
      studentsWithoutTraining: inactive,
      workoutsToday: (() => {
        const items = done
          .filter((s) => t(s.startedAt) >= todayStart && t(s.startedAt) <= todayEnd)
          .sort((a, b) => t(b.startedAt) - t(a.startedAt))
          .map((s) => ({
            sessionId: s.id,
            student: card(s.studentId),
            workout: byId(d.workouts, s.workoutId)?.name ?? null,
            startedAt: s.startedAt,
            durationSeconds: s.durationSeconds,
          }));
        return { count: items.length, items };
      })(),
      pendingAssessments: {
        overdueScheduled: scheduled
          .filter((a) => a.scheduledFor && t(a.scheduledFor) < now.getTime())
          .map((a) => ({ id: a.id, scheduledFor: a.scheduledFor, student: { id: a.studentId, name: studentUser(a.studentId).name } })),
        studentsDue: needsAssessment.map((l) => card(l.studentId)),
      },
      upcomingAssessments: scheduled
        .filter((a) => a.scheduledFor && t(a.scheduledFor) >= now.getTime())
        .slice(0, 10)
        .map((a) => ({ id: a.id, scheduledFor: a.scheduledFor, student: card(a.studentId) })),
      agendaToday: d.appointments
        .filter((a) => a.trainerId === trainerId && t(a.startsAt) >= todayStart && t(a.startsAt) <= todayEnd && a.status !== 'CANCELED')
        .sort((a, b) => t(a.startsAt) - t(b.startsAt))
        .map((a) => ({ id: a.id, startsAt: a.startsAt, endsAt: a.endsAt, status: a.status, student: a.studentId ? card(a.studentId) : null })),
      overallEvolution: {
        averageWeightDeltaKg: weightDeltas.length ? round(weightDeltas.reduce((a, b) => a + b, 0) / weightDeltas.length, 1) : null,
        studentsWithWeightData: weightDeltas.length,
        workoutsThisMonth: done.filter((s) => t(s.startedAt) >= startOfMonth(now).getTime()).length,
      },
      attendanceRate: attendanceRate(done.filter((s) => t(s.startedAt) >= fourWeeksAgo).length, plannedPerWeek, 4),
      goalsNearCompletion: goalsNear,
      pendingAiSuggestions: d.aiSuggestions.filter((s) => s.trainerId === trainerId && s.status === 'PENDING').length,
      unreadMessages: d.messages.filter((m) => linkIds.has(m.trainerStudentId) && !m.readAt && m.senderId !== trainerUserId).length,
      subscription: sub
        ? {
            plan: sub.plan.name,
            status: sub.status,
            currentPeriodEnd: sub.currentPeriodEnd,
            maxStudents: sub.plan.maxStudents,
            usedSeats: links.filter((l) => l.status !== 'INACTIVE').length,
          }
        : null,
    };
  },

  student(studentId: string) {
    const d = db();
    const now = new Date();
    const student = studentById(studentId)!;
    const u = userOf(student.userId);
    const today = workouts.today(studentId, now);
    const next = d.appointments
      .filter((a) => a.studentId === studentId && t(a.startsAt) >= now.getTime() && (a.status === 'CONFIRMED' || a.status === 'REQUESTED'))
      .sort((a, b) => t(a.startsAt) - t(b.startsAt))[0];
    const sess = completedSessions(studentId);
    const activeGoals = d.goals.filter((g) => g.studentId === studentId && g.status === 'ACTIVE').sort((a, b) => t(a.createdAt) - t(b.createdAt));
    const link = access.primaryLinkForStudent(studentId);
    const stats = trainingStats(sess, now);
    const g0 = activeGoals[0];
    return {
      greetingName: u.name.split(' ')[0],
      todayWorkout: today
        ? {
            id: today.id,
            name: today.name,
            label: today.label,
            exercisesCount: today.exercises.length,
            scheduledForToday: today.scheduledForToday,
            completedToday: today.completedToday,
          }
        : null,
      nextAppointment: next ? { id: next.id, startsAt: next.startsAt, status: next.status, trainerName: trainerUser(next.trainerId).name } : null,
      weekProgress: { done: stats.weekCount, planned: student.weeklyFrequency, pct: attendanceRate(stats.weekCount, student.weeklyFrequency) },
      weight: {
        currentKg: student.currentWeightKg,
        initialKg: student.initialWeightKg,
        evolution: student.initialWeightKg !== null && student.currentWeightKg !== null ? evolution(student.initialWeightKg, student.currentWeightKg) : null,
      },
      mainGoal: g0
        ? (() => {
            const values = { startValue: g0.startValue, currentValue: g0.currentValue, targetValue: g0.targetValue };
            return { id: g0.id, title: g0.title, unit: g0.unit, ...values, progressPct: goalProgress(values) };
          })()
        : null,
      goalsCount: activeGoals.length,
      totalWorkouts: sess.length,
      lastWorkout: sess[0] ? { id: sess[0].id, name: byId(d.workouts, sess[0].workoutId)?.name ?? null, startedAt: sess[0].startedAt } : null,
      stats,
      trainer: link
        ? (() => {
            const tu = trainerUser(link.trainerId);
            return { id: link.trainerId, name: tu.name, avatarUrl: tu.avatarUrl, conversationId: link.id };
          })()
        : null,
      unreadNotifications: d.notifications.filter((n) => n.userId === u.id && !n.readAt).length,
    };
  },
};

// ---------------------------------------------------------------------------
// Conta (LGPD) e administração
// ---------------------------------------------------------------------------

export const account = {
  export(userId: string) {
    const d = db();
    const u = userOf(userId);
    const { password: _p, ...safeUser } = u;
    const tr = d.trainers.find((x) => x.userId === userId);
    const st = d.students.find((x) => x.userId === userId);
    return {
      exportedAt: nowIso(),
      format: 'personalpro-export/v1',
      data: {
        ...safeUser,
        notifications: d.notifications.filter((n) => n.userId === userId),
        sentMessages: d.messages.filter((m) => m.senderId === userId),
        trainer: tr
          ? {
              ...tr,
              students: d.links.filter((l) => l.trainerId === tr.id).map((l) => ({ ...l, student: students.serialize(studentById(l.studentId)!) })),
              exercises: d.exercises.filter((e) => e.trainerId === tr.id),
              workouts: d.workouts.filter((w) => w.trainerId === tr.id).map((w) => workouts.serialize(w)),
              notes: d.notes.filter((n) => n.trainerId === tr.id),
              invites: d.invites.filter((i) => i.trainerId === tr.id),
              subscription: subscriptions.getForTrainer(tr.id).subscription,
            }
          : null,
        student: st
          ? {
              ...st,
              trainers: d.links.filter((l) => l.studentId === st.id),
              workouts: workouts.activeAssignments(st.id).map((a) => ({ ...a, workout: workouts.serialize(byId(d.workouts, a.workoutId)!) })),
              sessions: d.sessions.filter((s) => s.studentId === st.id).map((s) => ({ ...s, sets: d.sets.filter((x) => x.sessionId === s.id) })),
              assessments: d.assessments.filter((a) => a.studentId === st.id).map((a) => assessments.serialize(a)),
              goals: d.goals.filter((g) => g.studentId === st.id),
              appointments: d.appointments.filter((a) => a.studentId === st.id),
              reports: d.reports.filter((r) => r.studentId === st.id),
            }
          : null,
      },
    };
  },
  delete(userId: string, password?: string) {
    const d = db();
    const u = userOf(userId);
    if (u.password && password !== u.password) throw unauthorized('Confirme sua senha para excluir a conta');
    const tr = d.trainers.find((x) => x.userId === userId);
    const st = d.students.find((x) => x.userId === userId);
    if (tr) {
      d.links.forEach((l) => {
        if (l.trainerId === tr.id) Object.assign(l, { status: 'INACTIVE', endedAt: nowIso() });
      });
      for (const w of d.workouts.filter((x) => x.trainerId === tr.id)) workouts.remove(tr.id, w.id);
      d.exercises.forEach((e) => {
        if (e.trainerId === tr.id && d.sets.some((s) => s.exerciseId === e.id)) Object.assign(e, { trainerId: null, archivedAt: nowIso() });
      });
      d.exercises = d.exercises.filter((e) => e.trainerId !== tr.id);
      d.notes = d.notes.filter((n) => n.trainerId !== tr.id);
      d.invites = d.invites.filter((i) => i.trainerId !== tr.id);
      d.aiSuggestions = d.aiSuggestions.filter((s) => s.trainerId !== tr.id);
      d.reports = d.reports.filter((r) => r.trainerId !== tr.id);
      d.appointments = d.appointments.filter((a) => a.trainerId !== tr.id);
      const subIds = d.subscriptions.filter((s) => s.trainerId === tr.id).map((s) => s.id);
      d.payments = d.payments.filter((p) => !subIds.includes(p.subscriptionId));
      d.subscriptions = d.subscriptions.filter((s) => s.trainerId !== tr.id);
      d.goals.forEach((g) => {
        if (g.trainerId === tr.id) g.trainerId = null;
      });
      d.trainers = d.trainers.filter((x) => x.id !== tr.id);
    }
    if (st) {
      const linkIds = new Set(d.links.filter((l) => l.studentId === st.id).map((l) => l.id));
      const sessionIds = new Set(d.sessions.filter((s) => s.studentId === st.id).map((s) => s.id));
      d.sets = d.sets.filter((s) => !sessionIds.has(s.sessionId));
      d.sessions = d.sessions.filter((s) => s.studentId !== st.id);
      d.messages = d.messages.filter((m) => !linkIds.has(m.trainerStudentId));
      d.links = d.links.filter((l) => l.studentId !== st.id);
      d.studentWorkouts = d.studentWorkouts.filter((s) => s.studentId !== st.id);
      d.assessments = d.assessments.filter((a) => a.studentId !== st.id);
      d.goals = d.goals.filter((g) => g.studentId !== st.id);
      d.notes = d.notes.filter((n) => n.studentId !== st.id);
      d.aiSuggestions = d.aiSuggestions.filter((s) => s.studentId !== st.id);
      d.reports = d.reports.filter((r) => r.studentId !== st.id);
      d.appointments = d.appointments.filter((a) => a.studentId !== st.id);
      d.students = d.students.filter((x) => x.id !== st.id);
    }
    d.tokens = d.tokens.filter((x) => x.userId !== userId);
    d.notifications = d.notifications.filter((n) => n.userId !== userId);
    Object.assign(u, {
      email: `deleted+${userId}@personalpro.invalid`,
      name: 'Conta excluída',
      phone: null,
      avatarUrl: null,
      password: null,
      marketingOptIn: false,
      deletedAt: nowIso(),
    });
  },
};

export const admin = {
  metrics() {
    const d = db();
    const now = new Date();
    const d30 = addDays(now, -30).getTime();
    const yearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).getTime();
    const alive = d.users.filter((u) => !u.deletedAt);
    const days = Array.from({ length: 30 }, (_, i) => toDateKey(addDays(now, -29 + i)));
    const months = Array.from({ length: 12 }, (_, i) => {
      const dd = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return `${dd.getFullYear()}-${`${dd.getMonth() + 1}`.padStart(2, '0')}`;
    });
    const activeSubs = d.subscriptions.filter((s) => s.status === 'ACTIVE').map((s) => ({ ...s, plan: byId(d.plans, s.planId)! }));
    const byStatus: Record<string, number> = {};
    d.subscriptions.forEach((s) => (byStatus[s.status] = (byStatus[s.status] ?? 0) + 1));
    const byPlan: Record<string, number> = {};
    activeSubs.forEach((s) => (byPlan[s.plan.name] = (byPlan[s.plan.name] ?? 0) + 1));
    const paid = d.payments.filter((p) => p.status === 'PAID' && p.paidAt);
    const workoutsRaw = d.sessions.filter((s) => s.status === 'COMPLETED' && t(s.startedAt) >= d30);
    const signups = d.users.filter((u) => t(u.createdAt) >= d30);
    return {
      totals: {
        trainers: alive.filter((u) => u.role === 'TRAINER').length,
        students: alive.filter((u) => u.role === 'STUDENT').length,
        activeUsers30d: alive.filter((u) => u.lastLoginAt && t(u.lastLoginAt) >= d30).length,
        newSignups30d: alive.filter((u) => t(u.createdAt) >= d30).length,
        workouts30d: workoutsRaw.length,
      },
      subscriptions: { byStatus, activeByPlan: byPlan },
      revenue: {
        mrrCents: activeSubs.reduce((acc, s) => acc + (s.plan.interval === 'YEARLY' ? Math.round(s.plan.priceCents / 12) : s.plan.priceCents), 0),
        last30dCents: paid.filter((p) => t(p.paidAt) >= d30).reduce((a, p) => a + p.amountCents, 0),
        monthly: months.map((m) => ({
          month: m,
          amountCents: paid.filter((p) => t(p.paidAt) >= yearAgo && toDateKey(p.paidAt!).startsWith(m)).reduce((a, p) => a + p.amountCents, 0),
        })),
      },
      series: {
        signups: days.map((day) => ({
          date: day,
          trainers: signups.filter((u) => u.role === 'TRAINER' && toDateKey(u.createdAt) === day).length,
          students: signups.filter((u) => u.role === 'STUDENT' && toDateKey(u.createdAt) === day).length,
        })),
        workouts: days.map((day) => ({ date: day, count: workoutsRaw.filter((w) => toDateKey(w.startedAt) === day).length })),
      },
    };
  },
  users(q: { role?: string; search?: string; page: number; pageSize: number }) {
    const d = db();
    const s = q.search?.toLowerCase();
    const all = d.users
      .filter((u) => (!q.role || u.role === q.role) && (!s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)))
      .sort((a, b) => t(b.createdAt) - t(a.createdAt));
    const items = all.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map((u) => {
      const tr = d.trainers.find((x) => x.userId === u.id);
      const sub = tr ? subscriptions.withPlan(tr.id) : null;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        deletedAt: u.deletedAt,
        trainer: tr
          ? {
              id: tr.id,
              cref: tr.cref,
              _count: { students: d.links.filter((l) => l.trainerId === tr.id).length },
              subscription: sub ? { status: sub.status, plan: { name: sub.plan.name } } : null,
            }
          : null,
      };
    });
    return { items, total: all.length, page: q.page, pageSize: q.pageSize };
  },
  subscriptions(status?: string) {
    const d = db();
    return d.subscriptions
      .filter((s) => !status || s.status === status)
      .sort((a, b) => t(b.updatedAt) - t(a.updatedAt))
      .map((s) => {
        const tr = trainerById(s.trainerId)!;
        const u = userOf(tr.userId);
        return {
          ...s,
          plan: byId(d.plans, s.planId)!,
          trainer: { ...tr, user: { name: u.name, email: u.email }, _count: { students: d.links.filter((l) => l.trainerId === tr.id).length } },
          payments: d.payments
            .filter((p) => p.subscriptionId === s.id)
            .sort((a, b) => t(b.createdAt) - t(a.createdAt))
            .slice(0, 3),
        };
      });
  },
  plans() {
    return [...db().plans]
      .sort((a, b) => a.priceCents - b.priceCents)
      .map((p) => ({ ...p, _count: { subscriptions: db().subscriptions.filter((s) => s.planId === p.id).length } }));
  },
  validatePlan(dto: any, partial: boolean) {
    const errors: string[] = [];
    if (!partial || dto.code !== undefined) if (!/^[A-Z0-9_]{3,40}$/.test(String(dto.code ?? ''))) errors.push('code must match /^[A-Z0-9_]{3,40}$/ regular expression');
    if (!partial || dto.name !== undefined) if (!dto.name || String(dto.name).length < 2) errors.push('name must be longer than or equal to 2 characters');
    if (!partial || dto.priceCents !== undefined) if (!Number.isInteger(dto.priceCents) || dto.priceCents < 0) errors.push('priceCents must be an integer number');
    if (errors.length) throw badRequest(errors);
  },
  createPlan(dto: any) {
    if (db().plans.some((p) => p.code === dto.code)) throw conflict('Registro já existe');
    const now = nowIso();
    const p = {
      id: uuid(),
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      maxStudents: dto.maxStudents ?? null,
      priceCents: dto.priceCents,
      currency: 'BRL',
      interval: dto.interval ?? 'MONTHLY',
      active: dto.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
    db().plans.push(p);
    return p;
  },
  updatePlan(id: string, dto: any) {
    const p = byId(db().plans, id);
    if (!p) throw new HttpError(404, 'Registro não encontrado', 'NOT_FOUND');
    for (const k of ['code', 'name', 'description', 'maxStudents', 'priceCents', 'interval', 'active']) if (dto[k] !== undefined) (p as any)[k] = dto[k];
    if ('maxStudents' in dto && dto.maxStudents === null) p.maxStudents = null;
    p.updatedAt = nowIso();
    return p;
  },
  registerManualPayment(subscriptionId: string, amountCents: number) {
    const sub = byId(db().subscriptions, subscriptionId);
    if (!sub) throw notFound('Assinatura');
    const plan = byId(db().plans, sub.planId)!;
    const paidAt = new Date();
    const payment = {
      id: uuid(),
      subscriptionId,
      provider: 'MANUAL',
      providerPaymentId: null,
      amountCents,
      currency: 'BRL',
      status: 'PAID' as const,
      paidAt: iso(paidAt),
      createdAt: iso(paidAt),
    };
    db().payments.push(payment);
    Object.assign(sub, {
      status: 'ACTIVE',
      currentPeriodStart: iso(paidAt),
      currentPeriodEnd: iso(addDays(paidAt, plan.interval === 'YEARLY' ? 365 : 30)),
      updatedAt: iso(paidAt),
    });
    return payment;
  },
};
