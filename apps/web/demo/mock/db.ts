/**
 * Banco de dados em memória da demo (espelha o schema Prisma de apps/api de forma
 * simplificada). Persistido no localStorage deste navegador; se o armazenamento
 * estiver indisponível ou cheio, a demo segue funcionando só em memória.
 */
import { populateSeed } from './seed';

export type ID = string;
export type ISO = string;
type Dict = Record<string, unknown>;

export interface DbUser {
  id: ID;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  role: 'STUDENT' | 'TRAINER' | 'ADMIN';
  password: string | null;
  marketingOptIn: boolean;
  createdAt: ISO;
  lastLoginAt: ISO | null;
  deletedAt: ISO | null;
}

export interface DbTrainer {
  id: ID;
  userId: ID;
  inviteCode: string;
  cref: string | null;
  specialties: string[];
  bio: string | null;
  experienceYears: number | null;
  socialLinks: Record<string, string>;
  ratingAvg: number;
  ratingCount: number;
  gymIds: ID[];
  availability: { id: ID; weekday: number; startTime: string; endTime: string }[];
  createdAt: ISO;
}

export interface DbGym {
  id: ID;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
}

export interface DbStudent {
  id: ID;
  userId: ID;
  birthDate: ISO | null;
  sex: 'MALE' | 'FEMALE' | 'OTHER' | null;
  heightCm: number | null;
  initialWeightKg: number | null;
  currentWeightKg: number | null;
  goal: string | null;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  weeklyFrequency: number;
  gymId: ID | null;
  createdAt: ISO;
}

export interface DbLink {
  id: ID;
  trainerId: ID;
  studentId: ID;
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE';
  startedAt: ISO;
  endedAt: ISO | null;
  createdAt: ISO;
}

export interface DbInvite {
  id: ID;
  trainerId: ID;
  code: string;
  channel: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  expiresAt: ISO;
  acceptedAt: ISO | null;
  studentId: ID | null;
  createdAt: ISO;
}

export interface DbExercise {
  id: ID;
  trainerId: ID | null;
  name: string;
  description: string | null;
  muscleGroup: string;
  equipment: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  instructions: string[];
  commonMistakes: string[];
  archivedAt: ISO | null;
  createdAt: ISO;
}

export interface DbWorkoutExercise {
  id: ID;
  workoutId: ID;
  exerciseId: ID;
  order: number;
  sets: number;
  reps: string;
  suggestedLoadKg: number | null;
  restSeconds: number;
  technique: string;
  groupKey: string | null;
  notes: string | null;
}

export interface DbWorkout {
  id: ID;
  trainerId: ID;
  name: string;
  label: string | null;
  description: string | null;
  isTemplate: boolean;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface DbStudentWorkout {
  id: ID;
  studentId: ID;
  workoutId: ID;
  weekdays: number[];
  order: number;
  active: boolean;
  startsAt: ISO;
  endsAt: ISO | null;
  createdAt: ISO;
}

export interface DbSession {
  id: ID;
  studentId: ID;
  workoutId: ID | null;
  studentWorkoutId: ID | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  startedAt: ISO;
  finishedAt: ISO | null;
  durationSeconds: number | null;
  totalVolumeKg: number | null;
  estimatedCalories: number | null;
  perceivedEffort: number | null;
  notes: string | null;
  createdAt: ISO;
}

export interface DbSet {
  id: ID;
  sessionId: ID;
  exerciseId: ID;
  workoutExerciseId: ID | null;
  setNumber: number;
  loadKg: number;
  reps: number;
  rpe: number | null;
  notes: string | null;
  isPersonalRecord: boolean;
  completedAt: ISO;
}

export interface DbAssessment {
  id: ID;
  studentId: ID;
  trainerId: ID | null;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELED';
  scheduledFor: ISO | null;
  assessedAt: ISO | null;
  weightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  leanMassKg: number | null;
  visceralFat: number | null;
  notes: string | null;
  measurements: Record<string, number | null> | null;
  photos: { id: ID; angle: string; url: string }[];
  createdAt: ISO;
}

export interface DbGoal {
  id: ID;
  studentId: ID;
  trainerId: ID | null;
  type: string;
  title: string;
  unit: string;
  exerciseId: ID | null;
  startValue: number;
  currentValue: number;
  targetValue: number;
  deadline: ISO | null;
  status: 'ACTIVE' | 'ACHIEVED' | 'CANCELED';
  achievedAt: ISO | null;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface DbAppointment {
  id: ID;
  trainerId: ID;
  studentId: ID | null;
  requestedById: ID | null;
  status: 'AVAILABLE' | 'REQUESTED' | 'CONFIRMED' | 'CANCELED' | 'COMPLETED';
  startsAt: ISO;
  endsAt: ISO;
  location: string | null;
  notes: string | null;
  cancelReason: string | null;
  createdAt: ISO;
}

export interface DbMessage {
  id: ID;
  trainerStudentId: ID;
  senderId: ID;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';
  content: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  isQuestion: boolean;
  readAt: ISO | null;
  createdAt: ISO;
}

export interface DbNotification {
  id: ID;
  userId: ID;
  type: string;
  title: string;
  body: string;
  data: Record<string, string>;
  dedupeKey: string | null;
  readAt: ISO | null;
  sentAt: ISO | null;
  createdAt: ISO;
}

export interface DbNote {
  id: ID;
  trainerId: ID;
  studentId: ID;
  content: string;
  pinned: boolean;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface DbAiSuggestion {
  id: ID;
  trainerId: ID;
  studentId: ID;
  type: string;
  title: string;
  content: string;
  payload: Dict;
  source: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED';
  reviewedAt: ISO | null;
  createdAt: ISO;
}

export interface DbReport {
  id: ID;
  studentId: ID;
  trainerId: ID;
  weekStart: ISO;
  summary: string;
  data: Dict;
  createdAt: ISO;
}

export interface DbPlan {
  id: ID;
  code: string;
  name: string;
  description: string | null;
  maxStudents: number | null;
  priceCents: number;
  currency: string;
  interval: 'MONTHLY' | 'YEARLY';
  active: boolean;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface DbSubscription {
  id: ID;
  trainerId: ID;
  planId: ID;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  provider: string;
  providerSubscriptionId: string | null;
  providerCustomerId: string | null;
  currentPeriodStart: ISO;
  currentPeriodEnd: ISO;
  cancelAtPeriodEnd: boolean;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface DbPayment {
  id: ID;
  subscriptionId: ID;
  provider: string;
  providerPaymentId: string | null;
  amountCents: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  paidAt: ISO | null;
  createdAt: ISO;
}

export interface DbToken {
  token: string;
  userId: ID;
  kind: 'access' | 'refresh' | 'reset';
  expiresAt: ISO;
  revokedAt: ISO | null;
}

export interface DemoDb {
  version: number;
  seededAt: ISO;
  users: DbUser[];
  trainers: DbTrainer[];
  gyms: DbGym[];
  students: DbStudent[];
  links: DbLink[];
  invites: DbInvite[];
  exercises: DbExercise[];
  workouts: DbWorkout[];
  workoutExercises: DbWorkoutExercise[];
  studentWorkouts: DbStudentWorkout[];
  sessions: DbSession[];
  sets: DbSet[];
  assessments: DbAssessment[];
  goals: DbGoal[];
  appointments: DbAppointment[];
  messages: DbMessage[];
  notifications: DbNotification[];
  notes: DbNote[];
  aiSuggestions: DbAiSuggestion[];
  reports: DbReport[];
  plans: DbPlan[];
  subscriptions: DbSubscription[];
  payments: DbPayment[];
  tokens: DbToken[];
}

export const DB_VERSION = 1;
export const DB_KEY = 'personalpro.demo.db.v1';
/** Teto do JSON persistido (caracteres) — o localStorage costuma aceitar ~5 M. */
export const STORAGE_BUDGET = 4_000_000;

let current: DemoDb | null = null;
const listeners = new Set<(reason: string) => void>();

export function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* contexto não seguro */
  }
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`;
}

export const nowIso = () => new Date().toISOString();

/** URLs blob: não sobrevivem a um recarregamento — remove-as ao ler do armazenamento. */
function stripBlobUrls(value: unknown): unknown {
  if (typeof value === 'string') return value.startsWith('blob:') ? null : value;
  if (Array.isArray(value)) {
    return value
      .map(stripBlobUrls)
      .filter((v) => !(v && typeof v === 'object' && 'angle' in (v as Dict) && (v as Dict).url === null));
  }
  if (value && typeof value === 'object') {
    const out: Dict = {};
    for (const [k, v] of Object.entries(value as Dict)) out[k] = stripBlobUrls(v);
    return out;
  }
  return value;
}

function readStored(): DemoDb | null {
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoDb;
    if (!parsed || parsed.version !== DB_VERSION) return null;
    return stripBlobUrls(parsed) as DemoDb;
  } catch {
    return null;
  }
}

export function emptyDb(): DemoDb {
  return {
    version: DB_VERSION,
    seededAt: new Date().toISOString(),
    users: [],
    trainers: [],
    gyms: [],
    students: [],
    links: [],
    invites: [],
    exercises: [],
    workouts: [],
    workoutExercises: [],
    studentWorkouts: [],
    sessions: [],
    sets: [],
    assessments: [],
    goals: [],
    appointments: [],
    messages: [],
    notifications: [],
    notes: [],
    aiSuggestions: [],
    reports: [],
    plans: [],
    subscriptions: [],
    payments: [],
    tokens: [],
  };
}

/** Cria um banco novo com os dados de demonstração (datas relativas a agora). */
function seedFresh(): DemoDb {
  current = emptyDb();
  populateSeed();
  return current;
}

export function db(): DemoDb {
  if (!current) {
    current = readStored();
    if (!current) {
      seedFresh();
      save();
    }
  }
  return current!;
}

let quotaWarned = false;
let lastSize = 0;

export function serializedSize(): number {
  return lastSize || JSON.stringify(db()).length;
}

/** Persiste o banco. Retorna false quando não coube no armazenamento. */
export function save(): boolean {
  if (!current) return true;
  let raw: string;
  try {
    raw = JSON.stringify(current);
  } catch {
    return false;
  }
  lastSize = raw.length;
  try {
    if (raw.length > STORAGE_BUDGET) throw new Error('budget');
    window.localStorage.setItem(DB_KEY, raw);
    return true;
  } catch {
    if (!quotaWarned) {
      quotaWarned = true;
      emit('quota');
    }
    return false;
  }
}

export function resetDb() {
  seedFresh();
  try {
    window.localStorage.removeItem(DB_KEY);
  } catch {
    /* ignore */
  }
  save();
  emit('reset');
}

/** Outra aba alterou os dados: recarrega do armazenamento. */
export function reloadFromStorage() {
  const fresh = readStored();
  if (fresh) {
    current = fresh;
    emit('external');
  }
}

export function onDbEvent(fn: (reason: string) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit(reason: string) {
  listeners.forEach((l) => {
    try {
      l(reason);
    } catch {
      /* ignore */
    }
  });
}
