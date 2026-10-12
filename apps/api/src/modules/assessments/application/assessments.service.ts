import { Injectable } from '@nestjs/common';
import { AssessmentStatus, NotificationType, PhotoAngle, Prisma } from '@prisma/client';
import { BODY_MEASUREMENT_KEYS, calculateBmi, calculateLeanMass, round } from '@personalpro/shared';
import { AccessPolicyService } from '../../../common/access/access-policy.service';
import type { AuthUser } from '../../../common/auth/auth-user';
import { ForbiddenError, NotFoundError } from '../../../common/errors/domain-errors';
import { num } from '../../../common/utils/decimal';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { FilesService, UploadedFileLike } from '../../files/application/files.service';
import { GoalsService } from '../../goals/application/goals.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import {
  AssessmentDataDto,
  CreateAssessmentDto,
  ScheduleAssessmentDto,
  UpdateAssessmentDto,
} from '../presentation/assessments.dto';

const include = { measurements: true, photos: { orderBy: { angle: 'asc' } } } satisfies Prisma.BodyAssessmentInclude;
type AssessmentFull = Prisma.BodyAssessmentGetPayload<{ include: typeof include }>;

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
    private readonly files: FilesService,
    private readonly goals: GoalsService,
    private readonly notifications: NotificationsService,
  ) {}

  serialize(a: AssessmentFull) {
    const measurements = a.measurements
      ? Object.fromEntries(BODY_MEASUREMENT_KEYS.map((k) => [k, num(a.measurements![k])]))
      : null;
    return {
      id: a.id,
      studentId: a.studentId,
      trainerId: a.trainerId,
      status: a.status,
      scheduledFor: a.scheduledFor,
      assessedAt: a.assessedAt,
      weightKg: num(a.weightKg),
      heightCm: num(a.heightCm),
      bmi: num(a.bmi),
      bodyFatPct: num(a.bodyFatPct),
      muscleMassKg: num(a.muscleMassKg),
      leanMassKg: num(a.leanMassKg),
      visceralFat: num(a.visceralFat),
      notes: a.notes,
      measurements,
      photos: a.photos.map((p) => ({ id: p.id, angle: p.angle, url: p.url })),
    };
  }

  /** Registro de avaliação (professor vinculado ou o próprio aluno — autoavaliação de peso/medidas). */
  async create(user: AuthUser, dto: CreateAssessmentDto) {
    const studentId = await this.access.resolveStudentId(user, dto.studentId);
    const student = await this.prisma.student.findUniqueOrThrow({ where: { id: studentId } });
    const computed = this.compute(dto, num(student.heightCm));
    const assessment = await this.prisma.bodyAssessment.create({
      data: {
        studentId,
        trainerId: user.role === 'TRAINER' ? user.trainerId : null,
        status: AssessmentStatus.COMPLETED,
        assessedAt: dto.assessedAt ? new Date(dto.assessedAt) : new Date(),
        ...computed,
        notes: dto.notes,
        measurements: dto.measurements ? { create: dto.measurements } : undefined,
      },
      include,
    });
    await this.afterCompleted(assessment, user);
    return this.serialize(assessment);
  }

  /** Agenda uma avaliação futura (aparece em "próximas avaliações"). */
  async schedule(trainerId: string, dto: ScheduleAssessmentDto) {
    await this.access.assertTrainerCanAccessStudent(trainerId, dto.studentId);
    const assessment = await this.prisma.bodyAssessment.create({
      data: {
        studentId: dto.studentId,
        trainerId,
        status: AssessmentStatus.SCHEDULED,
        scheduledFor: new Date(dto.scheduledFor),
        notes: dto.notes,
      },
      include,
    });
    const student = await this.prisma.student.findUniqueOrThrow({ where: { id: dto.studentId } });
    await this.notifications.notify(student.userId, {
      type: NotificationType.ASSESSMENT,
      title: 'Avaliação física agendada',
      body: `Sua avaliação física foi agendada para ${new Date(dto.scheduledFor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })}.`,
      data: { assessmentId: assessment.id },
    });
    return this.serialize(assessment);
  }

  async update(user: AuthUser, id: string, dto: UpdateAssessmentDto) {
    const current = await this.getOwned(user, id, true);
    const student = await this.prisma.student.findUniqueOrThrow({ where: { id: current.studentId } });
    const completing = dto.status === AssessmentStatus.COMPLETED || (current.status === AssessmentStatus.SCHEDULED && dto.weightKg !== undefined);
    const merged = {
      weightKg: dto.weightKg ?? num(current.weightKg) ?? undefined,
      heightCm: dto.heightCm ?? num(current.heightCm) ?? undefined,
      bodyFatPct: dto.bodyFatPct ?? num(current.bodyFatPct) ?? undefined,
      muscleMassKg: dto.muscleMassKg ?? num(current.muscleMassKg) ?? undefined,
      leanMassKg: dto.leanMassKg,
      visceralFat: dto.visceralFat ?? num(current.visceralFat) ?? undefined,
    };
    const updated = await this.prisma.bodyAssessment.update({
      where: { id },
      data: {
        ...this.compute(merged, num(student.heightCm)),
        notes: dto.notes,
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
        status: completing ? AssessmentStatus.COMPLETED : dto.status,
        assessedAt: dto.assessedAt ? new Date(dto.assessedAt) : completing && !current.assessedAt ? new Date() : undefined,
        measurements: dto.measurements
          ? { upsert: { create: dto.measurements, update: dto.measurements } }
          : undefined,
      },
      include,
    });
    if (updated.status === AssessmentStatus.COMPLETED) await this.afterCompleted(updated, user);
    return this.serialize(updated);
  }

  async list(user: AuthUser, studentIdParam?: string, status?: AssessmentStatus) {
    const studentId = await this.access.resolveStudentId(user, studentIdParam);
    const items = await this.prisma.bodyAssessment.findMany({
      where: { studentId, status },
      include,
      orderBy: [{ assessedAt: { sort: 'desc', nulls: 'first' } }, { scheduledFor: 'desc' }],
    });
    return items.map((a) => this.serialize(a));
  }

  async get(user: AuthUser, id: string) {
    return this.serialize(await this.getOwned(user, id, false));
  }

  async remove(user: AuthUser, id: string) {
    await this.getOwned(user, id, true);
    await this.prisma.bodyAssessment.delete({ where: { id } });
  }

  /** Fotos de evolução: frente, costas, lateral direita e lateral esquerda. */
  async uploadPhoto(user: AuthUser, id: string, angle: PhotoAngle, file: UploadedFileLike | undefined) {
    const assessment = await this.getOwned(user, id, true);
    const stored = await this.files.upload(user.userId, file, 'progress', /^image\//);
    await this.prisma.progressPhoto.upsert({
      where: { assessmentId_angle: { assessmentId: id, angle } },
      create: { assessmentId: id, studentId: assessment.studentId, angle, url: stored.url },
      update: { url: stored.url },
    });
    return this.get(user, id);
  }

  /** ANTES x DEPOIS: duas avaliações lado a lado, com diferenças e fotos por ângulo. */
  async compare(user: AuthUser, beforeId: string, afterId: string) {
    const [before, after] = await Promise.all([this.getOwned(user, beforeId, false), this.getOwned(user, afterId, false)]);
    if (before.studentId !== after.studentId) throw new ForbiddenError('As avaliações devem ser do mesmo aluno');
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
          BODY_MEASUREMENT_KEYS.map((k) => [k, diff(a.measurements?.[k] ?? null, b.measurements?.[k] ?? null)]),
        ),
      },
      photos: Object.values(PhotoAngle).map((angle) => ({
        angle,
        before: a.photos.find((p) => p.angle === angle)?.url ?? null,
        after: b.photos.find((p) => p.angle === angle)?.url ?? null,
      })),
    };
  }

  private compute(dto: Pick<AssessmentDataDto, 'weightKg' | 'heightCm' | 'bodyFatPct' | 'muscleMassKg' | 'leanMassKg' | 'visceralFat'>, studentHeight: number | null) {
    const height = dto.heightCm ?? studentHeight ?? undefined;
    const bmi = dto.weightKg && height ? calculateBmi(dto.weightKg, height) : null;
    const leanMass = dto.leanMassKg ?? (dto.weightKg && dto.bodyFatPct !== undefined ? calculateLeanMass(dto.weightKg, dto.bodyFatPct) : null);
    return {
      weightKg: dto.weightKg,
      heightCm: height,
      bmi: bmi ?? undefined,
      bodyFatPct: dto.bodyFatPct,
      muscleMassKg: dto.muscleMassKg,
      leanMassKg: leanMass ?? undefined,
      visceralFat: dto.visceralFat,
    };
  }

  /** Atualiza peso/altura atuais do aluno (se for a avaliação mais recente) e as metas. */
  private async afterCompleted(assessment: AssessmentFull, user: AuthUser) {
    const latest = await this.prisma.bodyAssessment.findFirst({
      where: { studentId: assessment.studentId, status: AssessmentStatus.COMPLETED, weightKg: { not: null } },
      orderBy: { assessedAt: 'desc' },
    });
    const student = await this.prisma.student.findUniqueOrThrow({ where: { id: assessment.studentId } });
    if (latest) {
      await this.prisma.student.update({
        where: { id: student.id },
        data: {
          currentWeightKg: latest.weightKg,
          heightCm: latest.heightCm ?? undefined,
          initialWeightKg: student.initialWeightKg ?? latest.weightKg,
        },
      });
    }
    await this.goals.refreshForStudent(student.id);
    if (user.role === 'TRAINER') {
      await this.notifications.notify(student.userId, {
        type: NotificationType.ASSESSMENT,
        title: 'Nova avaliação física',
        body: 'Seu professor registrou uma nova avaliação física. Confira sua evolução!',
        data: { assessmentId: assessment.id },
      });
    }
  }

  /** Professor vinculado ou o próprio aluno. Para escrita, aluno só altera o que ele mesmo registrou. */
  private async getOwned(user: AuthUser, id: string, write: boolean) {
    const assessment = await this.prisma.bodyAssessment.findUnique({ where: { id }, include });
    if (!assessment) throw new NotFoundError('Avaliação');
    await this.access.resolveStudentId(user, assessment.studentId);
    if (write && user.role === 'STUDENT' && assessment.trainerId) {
      throw new ForbiddenError('Somente o professor pode alterar esta avaliação');
    }
    return assessment;
  }
}
