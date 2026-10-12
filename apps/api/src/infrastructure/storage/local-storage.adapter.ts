import { Injectable } from '@nestjs/common';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { AppConfig } from '../../config/app-config';
import { StoragePort, StoredObject } from './storage.port';

/** Armazenamento em disco para desenvolvimento. Servido em /uploads pela API. */
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

  private safePath(key: string): string {
    const path = resolve(join(this.root, key));
    if (!path.startsWith(this.root)) throw new Error('Chave de arquivo inválida');
    return path;
  }
}
