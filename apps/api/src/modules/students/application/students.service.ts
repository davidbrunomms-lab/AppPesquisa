import { Injectable } from '@nestjs/common';
import { InviteChannel, LinkStatus, Prisma, SessionStatus } from '@prisma/client';
import {
  daysSinceLastWorkout,
  evolution,
  startOfWeek,
  trainingStats,
  weeklyFrequencySeries,
} from '@personalpro/shared';
import { AppConfig } from '../../../config/app-config';
import { AccessPolicyService } from '../../../common/access/access-policy.service';
import type { AuthUser } from '../../../common/auth/auth-user';
import { ConflictError } from '../../../common/errors/domain-errors';
import { num } from '../../../common/utils/decimal';
import { MailPort } from '../../../infrastructure/mail/mail.port';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuthService } from '../../auth/application/auth.service';
import { normalizeEmail } from '../../auth/domain/password-policy';
import { InvitesService } from '../../invites/application/invites.service';
import { SubscriptionsService } from '../../subscriptions/application/subscriptions.service';
import { CreateStudentDto, ListStudentsQuery, StudentProfileDto, UpdateLinkDto } from '../presentation/students.dto';

const studentInclude = {
  user: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
  gym: true,
} satisfies Prisma.StudentInclude;

type StudentWithUser = Prisma.StudentGetPayload<{ include: typeof studentInclude }>;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
    private readonly subscriptions: SubscriptionsService,
    private readonly invites: InvitesService,
    private readonly auth: AuthService,
    private readonly mail: MailPort,
    private readonly config: AppConfig,
  ) {}

  serializeStudent(s: StudentWithUser) {
    const initial = num(s.initialWeightKg);
    const current = num(s.currentWeightKg);
    return {
      id: s.id,
      userId: s.user.id,
      name: s.user.name,
      email: s.user.email,
      phone: s.user.phone,
      avatarUrl: s.user.avatarUrl,
      birthDate: s.birthDate,
      sex: s.sex,
      heightCm: num(s.heightCm),
      initialWeightKg: initial,
      currentWeightKg: current,
      weightEvolution: initial !== null && current !== null ? evolution(initial, current) : null,
      goal: s.goal,
      level: s.level,
      weeklyFrequency: s.weeklyFrequency,
      gym: s.gym ? { id: s.gym.id, name: s.gym.name, city: s.gym.city } : null,
    };
  }

  /** Lista de alunos do professor com último treino, frequência semanal e evolução de peso. */
  async list(trainerId: string, q: ListStudentsQuery) {
    const search = q.search?.trim();
    const links = await this.prisma.trainerStudent.findMany({
      where: {
        trainerId,
        status: q.status,
        student: {
          goal: q.goal,
          level: q.level,
          ...(search
            ? {
                user: {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                  ],
                },
              }
            : {}),
        },
      },
      include: { student: { include: studentInclude } },
    });
    const ids = links.map((l) => l.studentId);
    const weekStart = startOfWeek(new Date());
    const [last, week] = await Promise.all([
      this.prisma.workoutSession.groupBy({
        by: ['studentId'],
        where: { studentId: { in: ids }, status: SessionStatus.COMPLETED },
        _max: { startedAt: true },
      }),
      this.prisma.workoutSession.groupBy({
        by: ['studentId'],
        where: { studentId: { in: ids }, status: SessionStatus.COMPLETED, startedAt: { gte: weekStart } },
        _count: true,
      }),
    ]);

    let items = links.map((link) => {
      const lastWorkoutAt = last.find((l) => l.studentId === link.studentId)?._max.startedAt ?? null;
      return {
        ...this.serializeStudent(link.student),
        linkId: link.id,
        status: link.status,
        startedAt: link.startedAt,
        lastWorkoutAt,
        daysSinceLastWorkout: daysSinceLastWorkout(lastWorkoutAt),
        workoutsThisWeek: week.find((w) => w.studentId === link.studentId)?._count ?? 0,
      };
    });

    if (q.inactiveDays) {
      items = items.filter((s) => s.daysSinceLastWorkout === null || s.daysSinceLastWorkout >= q.inactiveDays!);
    }
    items.sort((a, b) => {
      if (q.sort === 'lastWorkout') return (b.lastWorkoutAt?.getTime() ?? 0) - (a.lastWorkoutAt?.getTime() ?? 0);
      if (q.sort === 'startedAt') return b.startedAt.getTime() - a.startedAt.getTime();
      return a.name.localeCompare(b.name, 'pt-BR');
    });
    return items;
  }

  /**
   * Cadastro manual pelo professor. Se o e-mail já pertence a um aluno, envia
   * convite (o aluno precisa aceitar — não vinculamos contas sem consentimento).
   */
  async createManual(trainerId: string, dto: CreateStudentDto) {
    await this.subscriptions.assertCanAddStudent(trainerId);
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role !== 'STUDENT') throw new ConflictError('Este e-mail pertence a uma conta que não é de aluno');
      const invite = await this.invites.create(trainerId, { channel: InviteChannel.EMAIL, email, name: dto.name });
      return { invited: true, student: null, invite };
    }

    const trainer = await this.prisma.trainer.findUniqueOrThrow({ where: { id: trainerId }, include: { user: true } });
    const gymId = await this.resolveGym(dto.gymName, dto.gymCity);
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        phone: dto.phone,
        role: 'STUDENT',
        student: {
          create: {
            ...this.profileData(dto),
            initialWeightKg: dto.initialWeightKg ?? dto.currentWeightKg,
            gymId,
            trainers: {
              create: {
                trainerId,
                status: LinkStatus.ACTIVE,
                startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
              },
            },
          },
        },
      },
      include: { student: { include: studentInclude } },
    });

    const token = await this.auth.createPasswordToken(user.id, 7);
    await this.mail.send({
      to: email,
      subject: `${trainer.user.name} cadastrou você no PersonalPro`,
      text:
        `Olá, ${dto.name.split(' ')[0]}! ${trainer.user.name} cadastrou você como aluno no PersonalPro.\n\n` +
        `Crie sua senha para acessar seus treinos: ${this.config.appUrl}/redefinir-senha?token=${token}\n\n` +
        'O link é válido por 7 dias. Ao criar a senha você concorda com os termos de uso e a política de privacidade.',
    });
    return { invited: false, student: this.serializeStudent(user.student!), invite: null };
  }

  /** Perfil completo + estatísticas (professor vinculado ou o próprio aluno). */
  async detail(user: AuthUser, studentIdParam: string) {
    const studentId = await this.access.resolveStudentId(user, studentIdParam);
    const [student, links, sessions, goals, lastAssessment] = await Promise.all([
      this.prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: studentInclude }),
      this.prisma.trainerStudent.findMany({
        where: { studentId, ...(user.role === 'TRAINER' ? { trainerId: user.trainerId! } : {}) },
        include: { trainer: { include: { user: { select: { name: true, avatarUrl: true } } } } },
      }),
      this.prisma.workoutSession.findMany({
        where: { studentId, status: SessionStatus.COMPLETED },
        select: { startedAt: true, durationSeconds: true },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.studentGoal.findMany({ where: { studentId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } }),
      this.prisma.bodyAssessment.findFirst({
        where: { studentId, status: 'COMPLETED' },
        orderBy: { assessedAt: 'desc' },
        include: { measurements: true },
      }),
    ]);
    return {
      ...this.serializeStudent(student),
      trainers: links.map((l) => ({
        linkId: l.id,
        trainerId: l.trainerId,
        name: l.trainer.user.name,
        avatarUrl: l.trainer.user.avatarUrl,
        status: l.status,
        startedAt: l.startedAt,
      })),
      lastWorkoutAt: sessions[0]?.startedAt ?? null,
      totalWorkouts: sessions.length,
      stats: trainingStats(sessions),
      frequencySeries: weeklyFrequencySeries(sessions, 8),
      activeGoals: goals.length,
      lastAssessmentAt: lastAssessment?.assessedAt ?? null,
    };
  }

  async update(user: AuthUser, studentIdParam: string, dto: StudentProfileDto) {
    const studentId = await this.access.resolveStudentId(user, studentIdParam);
    const student = await this.prisma.student.findUniqueOrThrow({ where: { id: studentId } });
    const gymId = dto.gymName !== undefined ? await this.resolveGym(dto.gymName, dto.gymCity) : undefined;
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: student.userId },
        data: { name: dto.name, phone: dto.phone, avatarUrl: dto.avatarUrl },
      }),
      this.prisma.student.update({ where: { id: studentId }, data: { ...this.profileData(dto), gymId } }),
    ]);
    return this.detail(user, studentId);
  }

  async updateLink(trainerId: string, studentId: string, dto: UpdateLinkDto) {
    const link = await this.access.assertTrainerHasLink(trainerId, studentId);
    if (dto.status === LinkStatus.ACTIVE && link.status !== LinkStatus.ACTIVE) {
      await this.subscriptions.assertCanAddStudent(trainerId);
    }
    return this.prisma.trainerStudent.update({
      where: { id: link.id },
      data: {
        status: dto.status,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : undefined,
        endedAt: dto.status === LinkStatus.INACTIVE ? new Date() : dto.status === LinkStatus.ACTIVE ? null : undefined,
      },
    });
  }

  private profileData(dto: StudentProfileDto) {
    return {
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      sex: dto.sex,
      heightCm: dto.heightCm,
      initialWeightKg: dto.initialWeightKg,
      currentWeightKg: dto.currentWeightKg,
      goal: dto.goal,
      level: dto.level,
      weeklyFrequency: dto.weeklyFrequency,
    };
  }

  private async resolveGym(name?: string, city?: string): Promise<string | null | undefined> {
    if (name === undefined) return undefined;
    if (!name.trim()) return null;
    const gym = await this.prisma.gym.upsert({
      where: { name_city: { name: name.trim(), city: city?.trim() ?? '' } },
      create: { name: name.trim(), city: city?.trim() ?? '' },
      update: {},
    });
    return gym.id;
  }
}
