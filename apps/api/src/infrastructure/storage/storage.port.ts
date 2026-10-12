export interface StoredObject {
  key: string;
  url: string;
}

/** Porta de armazenamento de arquivos (fotos, vídeos, áudios, documentos). */
export abstract class StoragePort {
  /** URL pública permanente (mídias não sensíveis: avatar, exercícios). */
  abstract put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  abstract delete(key: string): Promise<void>;
  /** URL temporária assinada para arquivos privados (fotos de evolução, anexos do chat). */
  abstract signedUrl(key: string, ttlSeconds: number): Promise<string>;
}
