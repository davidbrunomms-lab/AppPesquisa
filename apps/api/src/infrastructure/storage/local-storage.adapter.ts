import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { AppConfig } from '../../config/app-config';
import { StoragePort, StoredObject } from './storage.port';

/**
 * Armazenamento em disco para desenvolvimento. Pastas públicas são servidas em
 * /uploads; arquivos privados apenas via GET /files/private/:key com assinatura.
 */
@Injectable()
export class LocalStorageAdapter extends StoragePort {
  private readonly root: string;

  constructor(private readonly config: AppConfig) {
    super();
    this.root = resolve(config.storage.localDir);
  }

  async put(key: string, body: Buffer): Promise<StoredObject> {
    const path = this.safePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    return { key, url: `${this.config.publicApiUrl}/uploads/${key}` };
  }

  async delete(key: string): Promise<void> {
    await rm(this.safePath(key), { force: true });
  }

  async signedUrl(key: string, ttlSeconds: number): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    return `${this.config.publicApiUrl}/files/private/${encodeURIComponent(key)}?exp=${exp}&sig=${this.sign(key, exp)}`;
  }

  /** Valida a assinatura e devolve o conteúdo do arquivo (ou null). */
  async readSigned(key: string, exp: number, sig: string): Promise<Buffer | null> {
    if (!exp || exp < Date.now() / 1000) return null;
    const expected = Buffer.from(this.sign(key, exp));
    const given = Buffer.from(sig ?? '');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      return await readFile(this.safePath(key));
    } catch {
      return null;
    }
  }

  private sign(key: string, exp: number) {
    return createHmac('sha256', this.config.jwt.accessSecret).update(`${key}:${exp}`).digest('base64url');
  }

  private safePath(key: string): string {
    const path = resolve(join(this.root, key));
    if (!path.startsWith(this.root)) throw new Error('Chave de arquivo inválida');
    return path;
  }
}
