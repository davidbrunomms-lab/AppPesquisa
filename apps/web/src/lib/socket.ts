'use client';

import type { Message } from '@personalpro/shared';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL, refreshTokens } from './api';
import { getSession } from './session';

let shared: Socket | null = null;
let refs = 0;

function getSocket() {
  if (!shared) {
    shared = io(`${API_URL}/chat`, {
      // Função: a cada (re)conexão usa o access token mais recente.
      auth: (cb) => cb({ token: getSession()?.accessToken ?? '' }),
      transports: ['websocket', 'polling'],
      reconnectionDelayMax: 10_000,
    });
    let attempts = 0;
    shared.on('connect', () => {
      // Só zera após a conexão se manter estável (o gateway valida o JWT depois do handshake).
      setTimeout(() => {
        if (shared?.connected) attempts = 0;
      }, 5000);
    });
    const reconnectWithFreshToken = async () => {
      // Token expirado → renova e tenta de novo (o refresh é single-flight).
      const s = getSession();
      if (!s || attempts >= 3) return;
      attempts++;
      const token = await refreshTokens(s.accessToken);
      if (token && shared && !shared.connected) setTimeout(() => shared?.connect(), 500);
    };
    shared.on('connect_error', reconnectWithFreshToken);
    // O gateway desconecta (io server disconnect) quando o JWT é inválido/expirado;
    // nesse caso o cliente não reconecta sozinho.
    shared.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') void reconnectWithFreshToken();
    });
  }
  return shared;
}

export interface ChatEvents {
  onMessage?: (m: Message) => void;
  onRead?: (e: { conversationId: string; readerId: string }) => void;
  onTyping?: (e: { conversationId: string; userId: string }) => void;
}

/** Conexão Socket.IO compartilhada com o namespace /chat. */
export function useChatSocket(events: ChatEvents) {
  const ref = useRef(events);
  ref.current = events;
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!getSession()) return;
    const socket = getSocket();
    socketRef.current = socket;
    refs++;
    const onMessage = (m: Message) => ref.current.onMessage?.(m);
    const onRead = (e: { conversationId: string; readerId: string }) => ref.current.onRead?.(e);
    const onTyping = (e: { conversationId: string; userId: string }) => ref.current.onTyping?.(e);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('message', onMessage);
    socket.on('read', onRead);
    socket.on('typing', onTyping);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setConnected(socket.connected);
    return () => {
      socket.off('message', onMessage);
      socket.off('read', onRead);
      socket.off('typing', onTyping);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      refs--;
      if (refs <= 0) {
        socket.disconnect();
        shared = null;
        refs = 0;
      }
    };
  }, []);

  const emitTyping = (conversationId: string) => socketRef.current?.emit('typing', { conversationId });
  return { connected, emitTyping };
}
