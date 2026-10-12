import { Injectable } from '@nestjs/common';
import { LinkStatus, MessageType, NotificationType, Prisma } from '@prisma/client';
import { AccessPolicyService } from '../../../common/access/access-policy.service';
import type { AuthUser } from '../../../common/auth/auth-user';
import { DomainError } from '../../../common/errors/domain-errors';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { FilesService, UploadedFileLike } from '../../files/application/files.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { ChatGateway } from './chat.gateway';

export interface SendMessageInput {
  type: MessageType;
  content?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentMime?: string;
  isQuestion?: boolean;
}

const PREVIEW: Record<MessageType, string> = {
  TEXT: '',
  IMAGE: '📷 Foto',
  VIDEO: '🎬 Vídeo',
  AUDIO: '🎤 Áudio',
  FILE: '📎 Arquivo',
};

const typeFromMime = (mime: string): MessageType =>
  mime.startsWith('image/') ? MessageType.IMAGE : mime.startsWith('video/') ? MessageType.VIDEO : mime.startsWith('audio/') ? MessageType.AUDIO : MessageType.FILE;

const linkInclude = {
  trainer: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
  student: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
} satisfies Prisma.TrainerStudentInclude;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
    private readonly files: FilesService,
    private readonly notifications: NotificationsService,
    private readonly gateway: ChatGateway,
  ) {}

  /** Conversas do usuário (uma por vínculo professor ⇄ aluno). */
  async conversations(user: AuthUser) {
    const links = await this.prisma.trainerStudent.findMany({
      where: {
        status: { not: LinkStatus.INACTIVE },
        ...(user.role === 'TRAINER' ? { trainerId: user.trainerId! } : { studentId: user.studentId ?? '' }),
      },
      include: { ...linkInclude, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    const unread = await this.prisma.message.groupBy({
      by: ['trainerStudentId'],
      where: { trainerStudentId: { in: links.map((l) => l.id) }, senderId: { not: user.userId }, readAt: null },
      _count: true,
    });
    return links
      .map((l) => {
        const other = user.role === 'TRAINER' ? l.student.user : l.trainer.user;
        return {
          id: l.id,
          trainerId: l.trainerId,
          studentId: l.studentId,
          participant: { userId: other.id, name: other.name, avatarUrl: other.avatarUrl },
          lastMessage: l.messages[0] ?? null,
          unreadCount: unread.find((u) => u.trainerStudentId === l.id)?._count ?? 0,
        };
      })
      .sort((a, b) => (b.lastMessage?.createdAt.getTime() ?? 0) - (a.lastMessage?.createdAt.getTime() ?? 0));
  }

  async messages(user: AuthUser, conversationId: string, before?: string, limit = 30) {
    await this.access.assertConversationMember(user, conversationId);
    const items = await this.prisma.message.findMany({
      where: { trainerStudentId: conversationId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
    return items.reverse();
  }

  async send(user: AuthUser, conversationId: string, input: SendMessageInput) {
    const link = await this.access.assertConversationMember(user, conversationId);
    if (link.status === LinkStatus.INACTIVE) throw new DomainError('Este acompanhamento está inativo', 'INACTIVE_LINK');
    if (input.type === MessageType.TEXT && !input.content?.trim()) throw new DomainError('Mensagem vazia', 'EMPTY_MESSAGE');
    if (input.type !== MessageType.TEXT && !input.attachmentUrl) throw new DomainError('Anexo obrigatório', 'ATTACHMENT_REQUIRED');

    const message = await this.prisma.message.create({
      data: {
        trainerStudentId: conversationId,
        senderId: user.userId,
        type: input.type,
        content: input.content?.trim(),
        attachmentUrl: input.attachmentUrl,
        attachmentName: input.attachmentName,
        attachmentMime: input.attachmentMime,
        isQuestion: input.isQuestion ?? false,
      },
      include: { sender: { select: { name: true } } },
    });
    this.gateway.emitMessage(conversationId, message);

    const full = await this.prisma.trainerStudent.findUniqueOrThrow({ where: { id: conversationId }, include: linkInclude });
    const recipient = user.role === 'TRAINER' ? full.student.user : full.trainer.user;
    const preview = input.content?.trim() || PREVIEW[input.type];
    await this.notifications.notify(recipient.id, {
      type: NotificationType.MESSAGE,
      title: input.isQuestion ? `Dúvida de ${message.sender.name}` : message.sender.name,
      body: preview.length > 120 ? `${preview.slice(0, 117)}...` : preview,
      data: { conversationId, messageId: message.id },
    });
    return message;
  }

  /** Foto, vídeo, áudio ou arquivo. */
  async sendAttachment(user: AuthUser, conversationId: string, file: UploadedFileLike | undefined, content?: string) {
    await this.access.assertConversationMember(user, conversationId);
    const stored = await this.files.upload(user.userId, file, 'chat');
    return this.send(user, conversationId, {
      type: typeFromMime(stored.mimeType),
      content,
      attachmentUrl: stored.url,
      attachmentName: file?.originalname,
      attachmentMime: stored.mimeType,
    });
  }

  async markRead(user: AuthUser, conversationId: string) {
    await this.access.assertConversationMember(user, conversationId);
    const { count } = await this.prisma.message.updateMany({
      where: { trainerStudentId: conversationId, senderId: { not: user.userId }, readAt: null },
      data: { readAt: new Date() },
    });
    if (count) this.gateway.emitRead(conversationId, user.userId);
    return { updated: count };
  }

  /** Botão rápido "Enviar dúvida ao professor". */
  async askQuestion(user: AuthUser, content: string) {
    const studentId = this.access.requireStudent(user);
    const link = await this.access.primaryLinkForStudent(studentId);
    if (!link) throw new DomainError('Você ainda não está vinculado a um professor', 'NO_TRAINER');
    return this.send(user, link.id, { type: MessageType.TEXT, content, isQuestion: true });
  }
}
