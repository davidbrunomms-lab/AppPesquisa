import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { DomainError } from '../../../common/errors/domain-errors';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { StoragePort } from '../../../infrastructure/storage/storage.port';

export const FILE_FOLDERS = ['avatars', 'exercises', 'chat', 'progress', 'documents'] as const;
export type FileFolder = (typeof FILE_FOLDERS)[number];

/** Pastas com URL pública permanente. As demais são privadas (URL assinada e temporária). */
export const PUBLIC_FOLDERS: FileFolder[] = ['avatars', 'exercises'];
const PRIVATE_PREFIX = 'private://';
/** Validade das URLs assinadas entregues aos clientes. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

const MB = 1024 * 1024;
const LIMITS: { pattern: RegExp; maxBytes: number }[] = [
  { pattern: /^image\/(jpeg|png|webp|heic|heif|gif)$/, maxBytes: 15 * MB },
  { pattern: /^video\/(mp4|quicktime|webm|3gpp)$/, maxBytes: 150 * MB },
  { pattern: /^audio\/(mpeg|mp4|aac|m4a|x-m4a|ogg|webm|wav|3gpp)$/, maxBytes: 25 * MB },
  {
    pattern:
      /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|text\/plain)$/,
    maxBytes: 25 * MB,
  },
];

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StoragePort,
  ) {}

  /** Valida tipo/tamanho, envia ao storage e registra o arquivo. */
  async upload(ownerId: string, file: UploadedFileLike | undefined, folder: FileFolder, allowed?: RegExp) {
    if (!file) throw new DomainError('Arquivo não enviado', 'FILE_REQUIRED');
    const rule = LIMITS.find((l) => l.pattern.test(file.mimetype));
    if (!rule || (allowed && !allowed.test(file.mimetype))) {
      throw new DomainError(`Tipo de arquivo não suportado: ${file.mimetype}`, 'FILE_TYPE');
    }
    if (file.size > rule.maxBytes) {
      throw new DomainError(`Arquivo excede o limite de ${rule.maxBytes / MB} MB`, 'FILE_TOO_LARGE');
    }
    const ext = extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8);
    const key = `${folder}/${ownerId}/${randomUUID()}${ext}`;
    const stored = await this.storage.put(key, file.buffer, file.mimetype);
    // Arquivos privados guardam uma referência (private://chave) resolvida em URL assinada na leitura
    const url = PUBLIC_FOLDERS.includes(folder) ? stored.url : `${PRIVATE_PREFIX}${stored.key}`;
    const saved = await this.prisma.fileObject.create({
      data: { ownerId, key: stored.key, url, mimeType: file.mimetype, sizeBytes: file.size },
    });
    return { ...saved, storedUrl: url, url: (await this.resolveUrl(url))! };
  }

  /** Converte referências privadas em URLs assinadas temporárias; URLs públicas passam direto. */
  async resolveUrl(url: string | null | undefined): Promise<string | null> {
    if (!url) return null;
    if (!url.startsWith(PRIVATE_PREFIX)) return url;
    return this.storage.signedUrl(url.slice(PRIVATE_PREFIX.length), SIGNED_URL_TTL_SECONDS);
  }

  findByKey(key: string) {
    return this.prisma.fileObject.findUnique({ where: { key } });
  }

  /** Remove do storage todos os arquivos do usuário (exclusão de conta). */
  async deleteAllOwnedBy(ownerId: string) {
    const files = await this.prisma.fileObject.findMany({ where: { ownerId } });
    await Promise.allSettled(files.map((f) => this.storage.delete(f.key)));
    await this.prisma.fileObject.deleteMany({ where: { ownerId } });
  }
}
