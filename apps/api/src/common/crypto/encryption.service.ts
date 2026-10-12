import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { AppConfig } from '../../config/app-config';

const PREFIX = 'enc:v1:';

/**
 * Criptografia de campos sensíveis em repouso (AES-256-GCM).
 * Formato: enc:v1:<iv>.<tag>.<ciphertext> (base64url).
 * Sem DATA_ENCRYPTION_KEY (somente em desenvolvimento) os valores ficam em texto puro.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer | null;

  constructor(config: AppConfig) {
    this.key = config.encryptionKey ? Buffer.from(config.encryptionKey, 'base64') : null;
    if (this.key && this.key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY deve ter 32 bytes (base64)');
    if (!this.key) this.logger.warn('DATA_ENCRYPTION_KEY ausente: campos sensíveis não serão criptografados');
  }

  encrypt(plain: string): string {
    if (!this.key) return plain;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${data.toString('base64url')}`;
  }

  decrypt(value: string): string {
    if (!value.startsWith(PREFIX)) return value;
    if (!this.key) throw new Error('Valor criptografado mas DATA_ENCRYPTION_KEY não configurada');
    const [iv, tag, data] = value.slice(PREFIX.length).split('.').map((p) => Buffer.from(p, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}

/** Hash determinístico para tokens opacos (refresh, reset de senha). */
export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
