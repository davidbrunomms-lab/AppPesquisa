import { Injectable } from '@nestjs/common';
import { LinkStatus, Prisma } from '@prisma/client';
import { timeToMinutes } from '@personalpro/shared';
import { AccessPolicyService } from '../../../common/access/access-policy.service';
import { DomainError, NotFoundError } from '../../../common/errors/domain-errors';
import { num } from '../../../common/utils/decimal';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { UpdateTrainerDto } from '../presentation/trainers.dto';

@Injectable()
export class TrainersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
  ) {}

  private readonly include = {
    user: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
    gyms: { include: { gym: true } },
    availability: { orderBy: [{ weekday: 'asc' as const }, { startTime: 'asc' as const }] },
  };

  async getMe(trainerId: string) {
    const [trainer, counts] = await Promise.all([
      this.prisma.trainer.findUniqueOrThrow({ where: { id: trainerId }, include: this.include }),
      this.prisma.trainerStudent.groupBy({ by: ['status'], where: { trainerId }, _count: true }),
    ]);
    const count = (status: LinkStatus) => counts.find((c) => c.status === status)?._count ?? 0;
    return {
      ...this.serialize(trainer),
      inviteCode: trainer.inviteCode,
      activeStudents: count(LinkStatus.ACTIVE),
      pendingStudents: count(LinkStatus.PENDING),
      inactiveStudents: count(LinkStatus.INACTIVE),
    };
  }

  async updateMe(trainerId: string, dto: UpdateTrainerDto) {
    for (const slot of dto.availability ?? []) {
      if (timeToMinutes(slot.startTime) >= timeToMinutes(slot.endTime)) {
        throw new DomainError('Horário inicial deve ser anterior ao final', 'INVALID_TIME_RANGE');
      }
    }
    const trainer = await this.prisma.trainer.findUniqueOrThrow({ where: { id: trainerId } });

    await this.prisma.$transaction(async (tx) => {
      if (dto.name || dto.phone !== undefined || dto.avatarUrl !== undefined) {
        await tx.user.update({
          where: { id: trainer.userId },
          data: { name: dto.name, phone: dto.phone, avatarUrl: dto.avatarUrl },
        });
      }
      await tx.trainer.update({
        where: { id: trainerId },
        data: {
          cref: dto.cref,
          specialties: dto.specialties,
          bio: dto.bio,
          experienceYears: dto.experienceYears,
          socialLinks: dto.socialLinks as Prisma.InputJsonValue | undefined,
        },
      });
      if (dto.gyms) {
        await tx.trainerGym.deleteMany({ where: { trainerId } });
        for (const g of dto.gyms) {
          const gym = await tx.gym.upsert({
            where: { name_city: { name: g.name.trim(), city: g.city?.trim() ?? '' } },
            create: { name: g.name.trim(), city: g.city?.trim() ?? '', state: g.state, address: g.address },
            update: {},
          });
          await tx.trainerGym.create({ data: { trainerId, gymId: gym.id } });
        }
      }
      if (dto.availability) {
        await tx.trainerAvailability.deleteMany({ where: { trainerId } });
        await tx.trainerAvailability.createMany({ data: dto.availability.map((a) => ({ ...a, trainerId })) });
      }
    });
    return this.getMe(trainerId);
  }

  async publicProfile(trainerId: string) {
    const trainer = await this.prisma.trainer.findUnique({ where: { id: trainerId }, include: this.include });
    if (!trainer) throw new NotFoundError('Professor');
    const { email: _email, ...user } = trainer.user;
    return { ...this.serialize(trainer), user };
  }

  /** Avaliação (1–5) feita por um aluno vinculado; recalcula a média. */
  async review(studentId: string, trainerId: string, rating: number, comment?: string) {
    await this.access.assertTrainerHasLink(trainerId, studentId);
    await this.prisma.trainerReview.upsert({
      where: { trainerId_studentId: { trainerId, studentId } },
      create: { trainerId, studentId, rating, comment },
      update: { rating, comment },
    });
    const agg = await this.prisma.trainerReview.aggregate({ where: { trainerId }, _avg: { rating: true }, _count: true });
    await this.prisma.trainer.update({
      where: { id: trainerId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
    });
    return { ratingAvg: Number((agg._avg.rating ?? 0).toFixed(2)), ratingCount: agg._count };
  }

  private serialize(trainer: Prisma.TrainerGetPayload<{ include: TrainersService['include'] }>) {
    return {
      id: trainer.id,
      user: trainer.user,
      cref: trainer.cref,
      specialties: trainer.specialties,
      bio: trainer.bio,
      experienceYears: trainer.experienceYears,
      socialLinks: trainer.socialLinks,
      ratingAvg: num(trainer.ratingAvg) ?? 0,
      ratingCount: trainer.ratingCount,
      gyms: trainer.gyms.map((g) => g.gym),
      availability: trainer.availability.map(({ id, weekday, startTime, endTime }) => ({ id, weekday, startTime, endTime })),
    };
  }
}
