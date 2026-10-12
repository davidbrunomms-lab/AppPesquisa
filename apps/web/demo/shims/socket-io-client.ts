/**
 * Shim de socket.io-client: barramento local de eventos. Mensagens enviadas pela
 * API simulada chegam na hora (e em outras abas via BroadcastChannel).
 */
import { db } from '../mock/db';
import { onRealtime } from '../mock/services';
import { userFromAccessToken } from '../mock/services';

type Fn = (...args: any[]) => void;
const sockets = new Set<FakeSocket>();

class FakeSocket {
  connected = false;
  disconnected = true;
  id = Math.random().toString(36).slice(2);
  private handlers = new Map<string, Set<Fn>>();
  private unsub: (() => void) | null = null;
  private userId: string | null = null;

  constructor(private readonly opts: { auth?: ((cb: (d: { token?: string }) => void) => void) | { token?: string } }) {
    setTimeout(() => this.connect(), 0);
  }

  private resolveUser() {
    let token: string | undefined;
    const a = this.opts.auth;
    if (typeof a === 'function') a((d) => (token = d?.token));
    else token = a?.token;
    return userFromAccessToken(token ?? null);
  }

  private isMember(conversationId: string) {
    if (!this.userId) return false;
    const user = this.resolveUser();
    if (!user) return false;
    const link = db().links.find((l) => l.id === conversationId);
    if (!link || link.status === 'INACTIVE') return false;
    return (user.role === 'TRAINER' && link.trainerId === user.trainerId) || (user.role === 'STUDENT' && link.studentId === user.studentId);
  }

  connect() {
    if (this.connected) return this;
    const user = this.resolveUser();
    if (!user) {
      this.fire('connect_error', new Error('unauthorized'));
      return this;
    }
    this.userId = user.userId;
    this.connected = true;
    this.disconnected = false;
    sockets.add(this);
    this.unsub = onRealtime((e) => {
      if (this.isMember(e.conversationId)) this.fire(e.type, e.payload);
    });
    this.fire('connect');
    return this;
  }

  open() {
    return this.connect();
  }

  disconnect() {
    if (!this.connected) return this;
    this.connected = false;
    this.disconnected = true;
    sockets.delete(this);
    this.unsub?.();
    this.unsub = null;
    this.fire('disconnect', 'io client disconnect');
    return this;
  }

  close() {
    return this.disconnect();
  }

  on(event: string, fn: Fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn);
    return this;
  }

  once(event: string, fn: Fn) {
    const wrap: Fn = (...args) => {
      this.off(event, wrap);
      fn(...args);
    };
    return this.on(event, wrap);
  }

  off(event?: string, fn?: Fn) {
    if (!event) this.handlers.clear();
    else if (!fn) this.handlers.delete(event);
    else this.handlers.get(event)?.delete(fn);
    return this;
  }

  removeAllListeners(event?: string) {
    return this.off(event);
  }

  /** Emissão do cliente: só "typing" tem efeito (repassado aos outros participantes). */
  emit(event: string, payload?: { conversationId?: string }) {
    if (event === 'typing' && payload?.conversationId && this.userId && this.isMember(payload.conversationId)) {
      const data = { conversationId: payload.conversationId, userId: this.userId };
      sockets.forEach((s) => {
        if (s !== this && s.userId !== this.userId && s.isMember(payload.conversationId!)) s.fire('typing', data);
      });
    }
    return this;
  }

  private fire(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.forEach((h) => {
      try {
        h(...args);
      } catch (e) {
        console.error(e);
      }
    });
  }
}

export function io(_url?: string, opts: ConstructorParameters<typeof FakeSocket>[0] = {}) {
  return new FakeSocket(opts);
}
export default io;
export type Socket = FakeSocket;
export const connect = io;
