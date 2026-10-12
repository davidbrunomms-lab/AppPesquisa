import type { Message } from '@personalpro/shared';
import { io, type Socket } from 'socket.io-client';
import { session } from './api';
import { API_URL } from './config';

type ChatEvents = {
  message: (m: Message) => void;
  read: (p: { conversationId: string; readerId?: string }) => void;
  typing: (p: { conversationId: string; userId?: string }) => void;
};

type EmitEvents = { typing: (p: { conversationId: string }) => void };

let socket: Socket<ChatEvents, EmitEvents> | null = null;
let currentToken: string | null = null;

/** Socket.IO do chat (namespace /chat, auth.token). Reconecta quando o access token muda. */
export function getChatSocket(): Socket<ChatEvents, EmitEvents> | null {
  const token = session.accessToken;
  if (!token) return null;
  if (socket && currentToken === token) return socket;
  socket?.disconnect();
  currentToken = token;
  socket = io(`${API_URL}/chat`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1500,
  }) as Socket<ChatEvents, EmitEvents>;
  return socket;
}

export function disconnectChatSocket() {
  socket?.disconnect();
  socket = null;
  currentToken = null;
}

session.onTokenChange((token) => {
  if (!token) disconnectChatSocket();
  else if (socket && currentToken !== token) {
    // atualiza o token para próximas reconexões
    currentToken = token;
    socket.auth = { token };
    socket.disconnect().connect();
  }
});
