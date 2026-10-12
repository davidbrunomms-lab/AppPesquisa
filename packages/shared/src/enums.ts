// Enums espelhando o schema Prisma (apps/api/prisma/schema.prisma) com rótulos em PT-BR.

export const UserRole = { STUDENT: 'STUDENT', TRAINER: 'TRAINER', ADMIN: 'ADMIN' } as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const Sex = { MALE: 'MALE', FEMALE: 'FEMALE', OTHER: 'OTHER' } as const;
export type Sex = (typeof Sex)[keyof typeof Sex];

export const TrainingLevel = {
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  ADVANCED: 'ADVANCED',
} as const;
export type TrainingLevel = (typeof TrainingLevel)[keyof typeof TrainingLevel];

export const TrainingGoal = {
  WEIGHT_LOSS: 'WEIGHT_LOSS',
  HYPERTROPHY: 'HYPERTROPHY',
  STRENGTH: 'STRENGTH',
  DEFINITION: 'DEFINITION',
  CONDITIONING: 'CONDITIONING',
  REHABILITATION: 'REHABILITATION',
  QUALITY_OF_LIFE: 'QUALITY_OF_LIFE',
  SPORTS_PREPARATION: 'SPORTS_PREPARATION',
} as const;
export type TrainingGoal = (typeof TrainingGoal)[keyof typeof TrainingGoal];

export const LinkStatus = { PENDING: 'PENDING', ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' } as const;
export type LinkStatus = (typeof LinkStatus)[keyof typeof LinkStatus];

export const InviteChannel = {
  CODE: 'CODE',
  QR_CODE: 'QR_CODE',
  EMAIL: 'EMAIL',
  WHATSAPP: 'WHATSAPP',
} as const;
export type InviteChannel = (typeof InviteChannel)[keyof typeof InviteChannel];

export const MuscleGroup = {
  CHEST: 'CHEST',
  BACK: 'BACK',
  SHOULDERS: 'SHOULDERS',
  BICEPS: 'BICEPS',
  TRICEPS: 'TRICEPS',
  QUADRICEPS: 'QUADRICEPS',
  HAMSTRINGS: 'HAMSTRINGS',
  GLUTES: 'GLUTES',
  CALVES: 'CALVES',
  ABS: 'ABS',
  CARDIO: 'CARDIO',
  MOBILITY: 'MOBILITY',
} as const;
export type MuscleGroup = (typeof MuscleGroup)[keyof typeof MuscleGroup];

export const TrainingTechnique = {
  NORMAL: 'NORMAL',
  DROP_SET: 'DROP_SET',
  REST_PAUSE: 'REST_PAUSE',
  BI_SET: 'BI_SET',
  TRI_SET: 'TRI_SET',
  PYRAMID: 'PYRAMID',
  SUPERSET: 'SUPERSET',
  ISOMETRY: 'ISOMETRY',
  CLUSTER_SET: 'CLUSTER_SET',
} as const;
export type TrainingTechnique = (typeof TrainingTechnique)[keyof typeof TrainingTechnique];

export const SessionStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  ABANDONED: 'ABANDONED',
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const AssessmentStatus = {
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  CANCELED: 'CANCELED',
} as const;
export type AssessmentStatus = (typeof AssessmentStatus)[keyof typeof AssessmentStatus];

export const PhotoAngle = { FRONT: 'FRONT', BACK: 'BACK', RIGHT: 'RIGHT', LEFT: 'LEFT' } as const;
export type PhotoAngle = (typeof PhotoAngle)[keyof typeof PhotoAngle];

export const GoalType = {
  BODY_WEIGHT: 'BODY_WEIGHT',
  BODY_FAT: 'BODY_FAT',
  WEEKLY_FREQUENCY: 'WEEKLY_FREQUENCY',
  EXERCISE_LOAD: 'EXERCISE_LOAD',
  CUSTOM: 'CUSTOM',
} as const;
export type GoalType = (typeof GoalType)[keyof typeof GoalType];

export const GoalStatus = { ACTIVE: 'ACTIVE', ACHIEVED: 'ACHIEVED', CANCELED: 'CANCELED' } as const;
export type GoalStatus = (typeof GoalStatus)[keyof typeof GoalStatus];

export const AppointmentStatus = {
  AVAILABLE: 'AVAILABLE',
  REQUESTED: 'REQUESTED',
  CONFIRMED: 'CONFIRMED',
  CANCELED: 'CANCELED',
  COMPLETED: 'COMPLETED',
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const MessageType = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  FILE: 'FILE',
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const NotificationType = {
  WORKOUT_REMINDER: 'WORKOUT_REMINDER',
  WORKOUT_UPDATED: 'WORKOUT_UPDATED',
  INACTIVITY: 'INACTIVITY',
  MILESTONE: 'MILESTONE',
  PERSONAL_RECORD: 'PERSONAL_RECORD',
  APPOINTMENT: 'APPOINTMENT',
  MESSAGE: 'MESSAGE',
  ASSESSMENT: 'ASSESSMENT',
  GOAL: 'GOAL',
  AI_SUGGESTION: 'AI_SUGGESTION',
  WEEKLY_REPORT: 'WEEKLY_REPORT',
  SYSTEM: 'SYSTEM',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const AiSuggestionType = {
  LOAD_PROGRESSION: 'LOAD_PROGRESSION',
  LOW_FREQUENCY: 'LOW_FREQUENCY',
  STAGNATION: 'STAGNATION',
  WORKOUT_ADJUSTMENT: 'WORKOUT_ADJUSTMENT',
  WEEKLY_SUMMARY: 'WEEKLY_SUMMARY',
  RECOMMENDATION: 'RECOMMENDATION',
} as const;
export type AiSuggestionType = (typeof AiSuggestionType)[keyof typeof AiSuggestionType];

export const AiSuggestionStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  APPLIED: 'APPLIED',
} as const;
export type AiSuggestionStatus = (typeof AiSuggestionStatus)[keyof typeof AiSuggestionStatus];

export const SubscriptionStatus = {
  TRIALING: 'TRIALING',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELED: 'CANCELED',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const PaymentProvider = {
  MANUAL: 'MANUAL',
  STRIPE: 'STRIPE',
  MERCADO_PAGO: 'MERCADO_PAGO',
  ASAAS: 'ASAAS',
} as const;
export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider];

// ---------------------------------------------------------------------------
// Rótulos PT-BR
// ---------------------------------------------------------------------------

export const TRAINING_GOAL_LABELS: Record<TrainingGoal, string> = {
  WEIGHT_LOSS: 'Emagrecimento',
  HYPERTROPHY: 'Hipertrofia',
  STRENGTH: 'Ganho de força',
  DEFINITION: 'Definição muscular',
  CONDITIONING: 'Condicionamento físico',
  REHABILITATION: 'Reabilitação',
  QUALITY_OF_LIFE: 'Qualidade de vida',
  SPORTS_PREPARATION: 'Preparação esportiva',
};

export const TRAINING_LEVEL_LABELS: Record<TrainingLevel, string> = {
  BEGINNER: 'Iniciante',
  INTERMEDIATE: 'Intermediário',
  ADVANCED: 'Avançado',
};

export const SEX_LABELS: Record<Sex, string> = {
  MALE: 'Masculino',
  FEMALE: 'Feminino',
  OTHER: 'Outro',
};

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  CHEST: 'Peito',
  BACK: 'Costas',
  SHOULDERS: 'Ombros',
  BICEPS: 'Bíceps',
  TRICEPS: 'Tríceps',
  QUADRICEPS: 'Quadríceps',
  HAMSTRINGS: 'Posterior de coxa',
  GLUTES: 'Glúteos',
  CALVES: 'Panturrilha',
  ABS: 'Abdômen',
  CARDIO: 'Cardio',
  MOBILITY: 'Mobilidade',
};

export const TECHNIQUE_LABELS: Record<TrainingTechnique, string> = {
  NORMAL: 'Convencional',
  DROP_SET: 'Drop set',
  REST_PAUSE: 'Rest pause',
  BI_SET: 'Bi-set',
  TRI_SET: 'Tri-set',
  PYRAMID: 'Pirâmide',
  SUPERSET: 'Supersérie',
  ISOMETRY: 'Isometria',
  CLUSTER_SET: 'Cluster set',
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  AVAILABLE: 'Horário disponível',
  REQUESTED: 'Solicitado',
  CONFIRMED: 'Confirmado',
  CANCELED: 'Cancelado',
  COMPLETED: 'Concluído',
};

export const PHOTO_ANGLE_LABELS: Record<PhotoAngle, string> = {
  FRONT: 'Frente',
  BACK: 'Costas',
  RIGHT: 'Lateral direita',
  LEFT: 'Lateral esquerda',
};

export const BODY_MEASUREMENT_LABELS = {
  neck: 'Pescoço',
  shoulders: 'Ombros',
  chest: 'Tórax',
  rightArm: 'Braço direito',
  leftArm: 'Braço esquerdo',
  waist: 'Cintura',
  abdomen: 'Abdômen',
  hip: 'Quadril',
  rightThigh: 'Coxa direita',
  leftThigh: 'Coxa esquerda',
  rightCalf: 'Panturrilha direita',
  leftCalf: 'Panturrilha esquerda',
} as const;
export type BodyMeasurementKey = keyof typeof BODY_MEASUREMENT_LABELS;
export const BODY_MEASUREMENT_KEYS = Object.keys(BODY_MEASUREMENT_LABELS) as BodyMeasurementKey[];
