import { Injectable } from '@nestjs/common';
import { InviteChannel, LinkStatus, NotificationType } from '@prisma/client';
import { addDays } from '@personalpro/shared';
import { AppConfig } from '../../../config/app-config';
import { ConflictError, NotFoundError } from '../../../common/errors/domain-errors';
import { readableCode } from '../../../common/utils/random';
import { MailPort } from '../../../infrastructure/mail/mail.port';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { SubscriptionsService } from '../../subscriptions/application/subscriptions.service';

/** Telefone em formato E.164 sem "+" (wa.me exige DDI). Números brasileiros sem DDI recebem 55. */
export function normalizePhone(raw?: string): string | undefined {
  const digits = raw?.replace(/\D/g, '');
  if (!digits) return undefined;
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

export interface CreateInviteInput {
  channel: InviteChannel;
  name?: string;
  email?: string;
  phone?: string;
  expiresInDays?: number;
}

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly mail: MailPort,
    private readonly notifications: NotificationsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  links(code: string) {
    return {
      webUrl: `${this.config.appUrl}/convite/${code}`,
      deepLink: `personalpro://convite/${code}`,
    };
  }

  async create(trainerId: string, input: CreateInviteInput) {
    await this.subscriptions.assertCanAddStudent(trainerId);
    const trainer = await this.prisma.trainer.findUniqueOrThrow({ where: { id: trainerId }, include: { user: true } });
    const invite = await this.prisma.studentInvite.create({
      data: {
        trainerId,
        code: await this.uniqueCode(),
        channel: input.channel,
        name: input.name,
        email: input.email?.toLowerCase(),
        phone: normalizePhone(input.phone),
        expiresAt: addDays(new Date(), input.expiresInDays ?? 7),
      },
    });
    const links = this.links(invite.code);
    const message =
      `Olá${input.name ? `, ${input.name.split(' ')[0]}` : ''}! ${trainer.user.name} convidou você para acompanhar seus treinos no PersonalPro. ` +
      `Baixe o app, crie sua conta e use o código ${invite.code} ou acesse ${links.webUrl}`;

    if (input.channel === InviteChannel.EMAIL && invite.email) {
      await this.mail.send({ to: invite.email, subject: `${trainer.user.name} convidou você para o PersonalPro`, text: message });
    }
    const whatsappUrl =
      input.channel === InviteChannel.WHATSAPP
        ? `https://wa.me/${invite.phone ?? ''}?text=${encodeURIComponent(message)}`
        : null;

    return { invite, ...links, whatsappUrl, message, qrCodeUrl: `${this.config.publicApiUrl}/invites/${invite.code}/qrcode.png` };
  }

  list(trainerId: string) {
    return this.prisma.studentInvite.findMany({
      where: { trainerId },
      orderBy: { createdAt: 'desc' },
      include: { student: { include: { user: { select: { name: true } } } } },
    });
  }

  async revoke(trainerId: string, id: string) {
    const { count } = await this.prisma.studentInvite.deleteMany({ where: { id, trainerId, acceptedAt: null } });
    if (!count) throw new NotFoundError('Convite');
  }

  /** Dados públicos exibidos antes do aluno aceitar. */
  async preview(code: string) {
    const target = await this.resolveCode(code);
    const trainer = await this.prisma.trainer.findUniqueOrThrow({
      where: { id: target.trainerId },
      include: { user: { select: { name: true, avatarUrl: true } } },
    });
    return {
      code: code.toUpperCase(),
      trainer: { id: trainer.id, name: trainer.user.name, avatarUrl: trainer.user.avatarUrl, cref: trainer.cref, specialties: trainer.specialties },
      invitedName: target.invite?.name ?? null,
    };
  }

  /**
   * Vincula o aluno ao professor. Aceita o código de um convite (uso único, com
   * validade) ou o código permanente do professor (trainers.invite_code).
   */
  async accept(studentId: string, code: string) {
    const target = await this.resolveCode(code);
    const existing = await this.prisma.trainerStudent.findUnique({
      where: { trainerId_studentId: { trainerId: target.trainerId, studentId } },
    });
    if (existing?.status === LinkStatus.ACTIVE) throw new ConflictError('Você já está vinculado a este professor');
    await this.subscriptions.assertCanAddStudent(target.trainerId);

    const link = await this.prisma.$transaction(async (tx) => {
      if (target.invite) {
        const { count } = await tx.studentInvite.updateMany({
          where: { id: target.invite.id, acceptedAt: null },
          data: { acceptedAt: new Date(), studentId },
        });
        if (!count) throw new ConflictError('Convite já utilizado');
      }
      return tx.trainerStudent.upsert({
        where: { trainerId_studentId: { trainerId: target.trainerId, studentId } },
        create: { trainerId: target.trainerId, studentId, status: LinkStatus.ACTIVE },
        update: { status: LinkStatus.ACTIVE, startedAt: new Date(), endedAt: null },
      });
    });

    const [trainer, student] = await Promise.all([
      this.prisma.trainer.findUniqueOrThrow({ where: { id: target.trainerId } }),
      this.prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { user: true } }),
    ]);
    await this.notifications.notify(trainer.userId, {
      type: NotificationType.SYSTEM,
      title: 'Novo aluno vinculado',
      body: `${student.user.name} aceitou seu convite.`,
      data: { studentId },
    });
    return link;
  }

  private async resolveCode(raw: string) {
    const code = raw.trim().toUpperCase();
    const invite = await this.prisma.studentInvite.findUnique({ where: { code } });
    if (invite) {
      if (invite.acceptedAt) throw new ConflictError('Convite já utilizado');
      if (invite.expiresAt < new Date()) throw new ConflictError('Convite expirado');
      return { trainerId: invite.trainerId, invite };
    }
    const trainer = await this.prisma.trainer.findUnique({ where: { inviteCode: code } });
    if (!trainer) throw new NotFoundError('Código de convite');
    return { trainerId: trainer.id, invite: null };
  }

  private async uniqueCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = readableCode(8);
      const [invite, trainer] = await Promise.all([
        this.prisma.studentInvite.findUnique({ where: { code } }),
        this.prisma.trainer.findUnique({ where: { inviteCode: code } }),
      ]);
      if (!invite && !trainer) return code;
    }
    throw new Error('Não foi possível gerar um código único');
  }

  /** Código permanente do professor (6 caracteres, distinto dos convites de 8). */
  async uniqueTrainerCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = readableCode(6);
      if (!(await this.prisma.trainer.findUnique({ where: { inviteCode: code } }))) return code;
    }
    throw new Error('Não foi possível gerar um código único');
  }
}
