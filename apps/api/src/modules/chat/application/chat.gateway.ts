import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { LinkStatus } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import { toAuthUser } from '../../../common/auth/jwt-auth.guard';
import type { AuthUser, JwtPayload } from '../../../common/auth/auth-user';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export const conversationRoom = (id: string) => `conversation:${id}`;
export const userRoom = (id: string) => `user:${id}`;

/**
 * Tempo real do chat (Socket.IO, namespace /chat).
 * Conexão: io(`${API}/chat`, { auth: { token: accessToken } }).
 * Eventos emitidos: "message" (nova mensagem), "read" (mensagens lidas), "typing".
 */
@WebSocketGateway({ namespace: '/chat', cors: { origin: true, credentials: true } })
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth?.token as string) ?? client.handshake.headers.authorization?.replace('Bearer ', '');
      const user = toAuthUser(await this.jwt.verifyAsync<JwtPayload>(token));
      client.data.user = user;
      const links = await this.prisma.trainerStudent.findMany({
        where: {
          status: { not: LinkStatus.INACTIVE },
          ...(user.role === 'TRAINER' ? { trainerId: user.trainerId! } : { studentId: user.studentId ?? '' }),
        },
        select: { id: true },
      });
      await client.join([userRoom(user.userId), ...links.map((l) => conversationRoom(l.id))]);
    } catch {
      this.logger.debug('Conexão de socket rejeitada (token inválido)');
      client.disconnect(true);
    }
  }

  @SubscribeMessage('typing')
  typing(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }) {
    const user = client.data.user as AuthUser | undefined;
    if (!user || !client.rooms.has(conversationRoom(body?.conversationId))) return;
    client.to(conversationRoom(body.conversationId)).emit('typing', { conversationId: body.conversationId, userId: user.userId });
  }

  emitMessage(conversationId: string, message: unknown) {
    this.server?.to(conversationRoom(conversationId)).emit('message', message);
  }

  emitRead(conversationId: string, readerId: string) {
    this.server?.to(conversationRoom(conversationId)).emit('read', { conversationId, readerId, at: new Date() });
  }
}
