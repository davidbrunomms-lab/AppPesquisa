export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export abstract class PushPort {
  /** Envia para os tokens e retorna os tokens inválidos (para remoção). */
  abstract send(tokens: string[], message: PushMessage): Promise<{ invalidTokens: string[] }>;
}
