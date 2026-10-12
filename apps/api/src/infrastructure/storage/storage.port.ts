export interface StoredObject {
  key: string;
  url: string;
}

/** Porta de armazenamento de arquivos (fotos, vídeos, áudios, documentos). */
export abstract class StoragePort {
  abstract put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  abstract delete(key: string): Promise<void>;
}
