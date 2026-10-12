import { AppConfig } from '../../config/app-config';
import { EncryptionService, sha256 } from './encryption.service';

const config = (key: string) => ({ encryptionKey: key }) as unknown as AppConfig;

describe('EncryptionService', () => {
  const key = Buffer.alloc(32, 1).toString('base64');

  it('criptografa e descriptografa (AES-256-GCM)', () => {
    const svc = new EncryptionService(config(key));
    const enc = svc.encrypt('Aluno relatou dor no ombro');
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(enc).not.toContain('ombro');
    expect(svc.decrypt(enc)).toBe('Aluno relatou dor no ombro');
  });

  it('usa IV aleatório (mesmo texto gera cifras diferentes)', () => {
    const svc = new EncryptionService(config(key));
    expect(svc.encrypt('x')).not.toBe(svc.encrypt('x'));
  });

  it('detecta adulteração', () => {
    const svc = new EncryptionService(config(key));
    const enc = svc.encrypt('segredo');
    const tampered = enc.slice(0, -2) + (enc.endsWith('A') ? 'B' : 'A') + enc.slice(-1);
    expect(() => svc.decrypt(tampered)).toThrow();
  });

  it('rejeita chave com tamanho inválido', () => {
    expect(() => new EncryptionService(config(Buffer.alloc(16).toString('base64')))).toThrow();
  });

  it('sha256 é determinístico', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
    expect(sha256('abc')).toHaveLength(64);
  });
});
