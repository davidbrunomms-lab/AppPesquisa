/**
 * Contratos de resposta da API REST (datas chegam como string ISO no JSON).
 * Referência completa: docs/API.md e docs/openapi.json (Swagger em /docs).
 */
import type {
  AiSuggestionStatus,
  AiSuggestionType,
  AppointmentStatus,
  AssessmentStatus,
  BodyMeasurementKey,
  GoalStatus,
  GoalType,
  InviteChannel,
  LinkStatus,
  MessageType,
  MuscleGroup,
  NotificationType,
  PhotoAngle,
  SessionStatus,
  Sex,
  SubscriptionStatus,
  TrainingGoal,
  TrainingLevel,
  TrainingTechnique,
  UserRole,
} from '../enums';
import type { Evolution } from '../domain/body';
import type { TrainingStats } from '../domain/frequency';
import type { LoadPoint } from '../domain/training';

type ISODate = string;

export interface ApiError {
  statusCode: number;
  code?: string;
  message: string | string[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  trainerId: string | null;
  studentId: string | null;
  hasPassword: boolean;
  createdAt: ISODate;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
  /** Erro ao vincular pelo código do professor (a conta foi criada mesmo assim). */
  linkError?: string | null;
  isNewUser?: boolean;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: 'STUDENT' | 'TRAINER';
  phone?: string;
  inviteCode?: string;
  cref?: string;
  acceptTerms: true;
  marketingOptIn?: boolean;
}

// ---------------------------------------------------------------------------
// Perfis
// ---------------------------------------------------------------------------

export interface Gym {
  id: string;
  name: string;
  city: string | null;
  state?: string | null;
  address?: string | null;
}

export interface AvailabilitySlot {
  id?: string;
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface TrainerProfile {
  id: string;
  user: { id: string; name: string; email?: string; phone: string | null; avatarUrl: string | null };
  cref: string | null;
  specialties: string[];
  bio: string | null;
  experienceYears: number | null;
  socialLinks: Record<string, string>;
  ratingAvg: number;
  ratingCount: number;
  gyms: Gym[];
  availability: AvailabilitySlot[];
  inviteCode?: string;
  activeStudents?: number;
  pendingStudents?: number;
  inactiveStudents?: number;
}

export interface StudentProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  birthDate: ISODate | null;
  sex: Sex | null;
  heightCm: number | null;
  initialWeightKg: number | null;
  currentWeightKg: number | null;
  weightEvolution: Evolution | null;
  goal: TrainingGoal | null;
  level: TrainingLevel;
  weeklyFrequency: number;
  gym: Gym | null;
}

/** Item de GET /students (lista do professor). */
export interface StudentListItem extends StudentProfile {
  linkId: string;
  status: LinkStatus;
  startedAt: ISODate;
  lastWorkoutAt: ISODate | null;
  daysSinceLastWorkout: number | null;
  workoutsThisWeek: number;
}

/** GET /students/:id e /students/me. */
export interface StudentDetail extends StudentProfile {
  trainers: { linkId: string; trainerId: string; name: string; avatarUrl: string | null; status: LinkStatus; startedAt: ISODate }[];
  lastWorkoutAt: ISODate | null;
  totalWorkouts: number;
  stats: TrainingStats;
  frequencySeries: { weekStart: string; count: number }[];
  activeGoals: number;
  lastAssessmentAt: ISODate | null;
}

export interface InviteResponse {
  invite: { id: string; code: string; channel: InviteChannel; expiresAt: ISODate };
  webUrl: string;
  deepLink: string;
  whatsappUrl: string | null;
  message: string;
  qrCodeUrl: string;
}

// ---------------------------------------------------------------------------
// Exercícios e treinos
// ---------------------------------------------------------------------------

export interface Exercise {
  id: string;
  trainerId: string | null;
  name: string;
  description: string | null;
  muscleGroup: MuscleGroup;
  equipment: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  instructions: string[];
  commonMistakes: string[];
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  order: number;
  sets: number;
  reps: string;
  /** Decimal serializado como string pela API. */
  suggestedLoadKg: string | number | null;
  restSeconds: number;
  technique: TrainingTechnique;
  groupKey: string | null;
  notes: string | null;
  exercise: Exercise;
}

export interface Workout {
  id: string;
  trainerId: string;
  name: string;
  label: string | null;
  description: string | null;
  isTemplate: boolean;
  exercises: WorkoutExercise[];
  studentWorkouts?: { studentId: string; weekdays: number[]; active: boolean; student: { user: { name: string; avatarUrl: string | null } } }[];
}

export interface AssignedWorkout extends Workout {
  assignmentId: string;
  weekdays: number[];
  order: number;
}

export interface TodayWorkout extends Workout {
  assignmentId: string;
  scheduledForToday: boolean;
  completedToday: boolean;
}

export interface SetEntry {
  id: string;
  setNumber: number;
  loadKg: number;
  reps: number;
  rpe: number | null;
  notes: string | null;
  isPersonalRecord: boolean;
}

/** Tela de execução: POST /sessions e GET /sessions/:id. */
export interface ExecutionView {
  id: string;
  status: SessionStatus;
  startedAt: ISODate;
  finishedAt: ISODate | null;
  durationSeconds: number | null;
  totalVolumeKg: number | null;
  estimatedCalories: number | null;
  perceivedEffort: number | null;
  notes: string | null;
  workout: { id: string; name: string; label: string | null } | null;
  exercises: {
    workoutExerciseId: string;
    exerciseId: string;
    order: number;
    name: string;
    muscleGroup: MuscleGroup;
    imageUrl: string | null;
    videoUrl: string | null;
    instructions: string[];
    sets: number;
    reps: string;
    suggestedLoadKg: number | null;
    restSeconds: number;
    technique: TrainingTechnique;
    groupKey: string | null;
    notes: string | null;
    previous: { date: ISODate; sets: { setNumber: number; loadKg: number; reps: number }[] } | null;
    personalBest: { loadKg: number; reps: number } | null;
    today: SetEntry[];
  }[];
}

export interface LogSetResponse {
  set: SetEntry & { exerciseId: string };
  isPersonalRecord: boolean;
  restSeconds: number;
}

export interface FinishSessionResponse extends ExecutionView {
  summary: {
    startedAt: ISODate;
    finishedAt: ISODate;
    durationSeconds: number;
    totalVolumeKg: number;
    estimatedCalories: number | null;
    setsCount: number;
    exercisesCount: number;
    personalRecords: { exercise: string; loadKg: number; reps: number }[];
    totalWorkouts: number;
  };
}

export interface SessionHistoryItem {
  id: string;
  workout: { id: string; name: string; label: string | null } | null;
  startedAt: ISODate;
  finishedAt: ISODate | null;
  durationSeconds: number | null;
  totalVolumeKg: number | null;
  estimatedCalories: number | null;
  perceivedEffort: number | null;
  setsCount: number;
}

// ---------------------------------------------------------------------------
// Evolução, avaliação e metas
// ---------------------------------------------------------------------------

export interface ProgressStats extends TrainingStats {
  plannedPerWeek: number;
  totalWorkouts: number;
  totalVolumeKg: number;
  weeklySeries: { weekStart: string; count: number }[];
  monthlySeries: { month: string; count: number }[];
}

export interface ExerciseProgressItem {
  exerciseId: string;
  name: string;
  muscleGroup: MuscleGroup;
  sessions: number;
  firstLoadKg: number;
  lastLoadKg: number;
  bestLoadKg: number;
  deltaKg: number;
  lastDate: string;
}

export interface ExerciseProgress {
  exercise: { id: string; name: string; muscleGroup: MuscleGroup };
  points: (LoadPoint & { estimatedOneRepMaxKg: number })[];
  evolution: Evolution | null;
}

export type Measurements = Record<BodyMeasurementKey, number | null>;

export interface BodyProgress {
  weight: Evolution | null;
  bodyFat: Evolution | null;
  muscleMass: Evolution | null;
  series: {
    assessmentId: string;
    date: ISODate;
    weightKg: number | null;
    bmi: number | null;
    bodyFatPct: number | null;
    muscleMassKg: number | null;
    leanMassKg: number | null;
    visceralFat: number | null;
    measurements: Measurements;
  }[];
}

export interface Assessment {
  id: string;
  studentId: string;
  trainerId: string | null;
  status: AssessmentStatus;
  scheduledFor: ISODate | null;
  assessedAt: ISODate | null;
  weightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  leanMassKg: number | null;
  visceralFat: number | null;
  notes: string | null;
  measurements: Measurements | null;
  photos: { id: string; angle: PhotoAngle; url: string }[];
}

export interface AssessmentComparison {
  before: Assessment;
  after: Assessment;
  deltas: {
    weightKg: number | null;
    bmi: number | null;
    bodyFatPct: number | null;
    muscleMassKg: number | null;
    leanMassKg: number | null;
    visceralFat: number | null;
    measurements: Record<BodyMeasurementKey, number | null>;
  };
  photos: { angle: PhotoAngle; before: string | null; after: string | null }[];
}

export interface Goal {
  id: string;
  studentId: string;
  trainerId: string | null;
  type: GoalType;
  title: string;
  unit: string;
  exerciseId: string | null;
  exerciseName: string | null;
  startValue: number;
  currentValue: number;
  targetValue: number;
  progressPct: number;
  deadline: ISODate | null;
  status: GoalStatus;
  achievedAt: ISODate | null;
}

// ---------------------------------------------------------------------------
// Agenda, chat, notificações
// ---------------------------------------------------------------------------

export interface Appointment {
  id: string;
  status: AppointmentStatus;
  startsAt: ISODate;
  endsAt: ISODate;
  location: string | null;
  notes: string | null;
  cancelReason: string | null;
  trainer: { id: string; name: string; avatarUrl: string | null };
  student: { id: string; name: string; avatarUrl: string | null } | null;
}

export interface Message {
  id: string;
  trainerStudentId: string;
  senderId: string;
  type: MessageType;
  content: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  isQuestion: boolean;
  readAt: ISODate | null;
  createdAt: ISODate;
}

export interface Conversation {
  id: string;
  trainerId: string;
  studentId: string;
  participant: { userId: string; name: string; avatarUrl: string | null };
  lastMessage: Message | null;
  unreadCount: number;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string>;
  readAt: ISODate | null;
  createdAt: ISODate;
}

export interface TrainerNote {
  id: string;
  studentId: string;
  content: string;
  pinned: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// ---------------------------------------------------------------------------
// IA e relatórios
// ---------------------------------------------------------------------------

export interface AiSuggestion {
  id: string;
  trainerId: string;
  studentId: string;
  type: AiSuggestionType;
  title: string;
  content: string;
  payload: Record<string, unknown>;
  source: string;
  status: AiSuggestionStatus;
  reviewedAt: ISODate | null;
  createdAt: ISODate;
  student?: { user: { name: string; avatarUrl: string | null } };
}

export interface WeeklyReport {
  id: string;
  studentId: string;
  trainerId: string;
  weekStart: ISODate;
  summary: string;
  data: import('../domain/weekly-report').WeeklyReportData & { aiNarrative: string | null };
  createdAt: ISODate;
}

// ---------------------------------------------------------------------------
// Dashboards
// ---------------------------------------------------------------------------

type PersonRef = { id: string; name: string; avatarUrl?: string | null };

export interface TrainerDashboard {
  activeStudents: number;
  inactiveLinks: number;
  newStudents: PersonRef[];
  studentsWithoutTraining: (PersonRef & { lastWorkoutAt: ISODate | null; daysWithoutTraining: number | null })[];
  workoutsToday: {
    count: number;
    items: { sessionId: string; student: PersonRef; workout: string | null; startedAt: ISODate; durationSeconds: number | null }[];
  };
  pendingAssessments: {
    overdueScheduled: { id: string; scheduledFor: ISODate; student: PersonRef }[];
    studentsDue: PersonRef[];
  };
  upcomingAssessments: { id: string; scheduledFor: ISODate; student: PersonRef }[];
  agendaToday: { id: string; startsAt: ISODate; endsAt: ISODate; status: AppointmentStatus; student: PersonRef | null }[];
  overallEvolution: { averageWeightDeltaKg: number | null; studentsWithWeightData: number; workoutsThisMonth: number };
  attendanceRate: number;
  goalsNearCompletion: { id: string; title: string; progressPct: number; student: PersonRef }[];
  pendingAiSuggestions: number;
  unreadMessages: number;
  subscription: { plan: string; status: SubscriptionStatus; currentPeriodEnd: ISODate; maxStudents: number | null; usedSeats: number } | null;
}

export interface StudentDashboard {
  greetingName: string;
  todayWorkout: {
    id: string;
    name: string;
    label: string | null;
    exercisesCount: number;
    scheduledForToday: boolean;
    completedToday: boolean;
  } | null;
  nextAppointment: { id: string; startsAt: ISODate; status: AppointmentStatus; trainerName: string } | null;
  weekProgress: { done: number; planned: number; pct: number };
  weight: { currentKg: number | null; initialKg: number | null; evolution: Evolution | null };
  mainGoal: { id: string; title: string; unit: string; startValue: number; currentValue: number; targetValue: number; progressPct: number } | null;
  goalsCount: number;
  totalWorkouts: number;
  lastWorkout: { id: string; name: string | null; startedAt: ISODate } | null;
  stats: TrainingStats;
  trainer: { id: string; name: string; avatarUrl: string | null; conversationId: string } | null;
  unreadNotifications: number;
}

// ---------------------------------------------------------------------------
// Assinaturas e admin
// ---------------------------------------------------------------------------

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  maxStudents: number | null;
  priceCents: number;
  currency: string;
  interval: 'MONTHLY' | 'YEARLY';
  active: boolean;
}

export interface MySubscription {
  subscription: {
    id: string;
    status: SubscriptionStatus;
    provider: string;
    currentPeriodEnd: ISODate;
    cancelAtPeriodEnd: boolean;
    plan: Plan;
    payments: { id: string; amountCents: number; status: string; paidAt: ISODate | null; createdAt: ISODate }[];
  } | null;
  entitled: boolean;
  usage: { students: number; maxStudents: number | null };
}

export interface AdminMetrics {
  totals: { trainers: number; students: number; activeUsers30d: number; newSignups30d: number; workouts30d: number };
  subscriptions: { byStatus: Partial<Record<SubscriptionStatus, number>>; activeByPlan: Record<string, number> };
  revenue: { mrrCents: number; last30dCents: number; monthly: { month: string; amountCents: number }[] };
  series: {
    signups: { date: string; trainers: number; students: number }[];
    workouts: { date: string; count: number }[];
  };
}
