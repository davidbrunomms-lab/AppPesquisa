/**
 * Uploads na demo: imagens viram data URL reduzida (máx. 1280 px, JPEG 0,8) e
 * ficam salvas no navegador; vídeo/áudio/outros (ou imagens que não cabem no
 * armazenamento) viram object URL, válida só nesta sessão.
 */
import { onDbEvent, serializedSize, STORAGE_BUDGET, uuid } from './db';
import { domain } from './http';

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

export interface StoredUpload {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  name: string;
  persisted: boolean;
}

let sessionOnlyNotified = false;
const sessionListeners = new Set<(kind: 'session-only') => void>();
export function onUploadNotice(fn: (kind: 'session-only') => void) {
  sessionListeners.add(fn);
  return () => {
    sessionListeners.delete(fn);
  };
}
onDbEvent((reason) => {
  if (reason === 'quota') sessionListeners.forEach((l) => l('session-only'));
});

function noticeSessionOnly() {
  if (sessionOnlyNotified) return;
  sessionOnlyNotified = true;
  sessionListeners.forEach((l) => l('session-only'));
}

async function downscale(file: File, max = 1280, quality = 0.8): Promise<string | null> {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = src;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(src);
  }
}

export async function storeUpload(file: File | null | undefined, allowed?: RegExp): Promise<StoredUpload> {
  if (!file || typeof file === 'string') throw domain('Arquivo não enviado', 'FILE_REQUIRED');
  const mime = file.type || 'application/octet-stream';
  const rule = LIMITS.find((l) => l.pattern.test(mime));
  if (!rule || (allowed && !allowed.test(mime))) throw domain(`Tipo de arquivo não suportado: ${mime}`, 'FILE_TYPE');
  if (file.size > rule.maxBytes) throw domain(`Arquivo excede o limite de ${rule.maxBytes / MB} MB`, 'FILE_TOO_LARGE');

  if (mime.startsWith('image/')) {
    const dataUrl = await downscale(file);
    if (dataUrl && serializedSize() + dataUrl.length < STORAGE_BUDGET) {
      return { id: uuid(), url: dataUrl, mimeType: 'image/jpeg', sizeBytes: Math.round((dataUrl.length * 3) / 4), name: file.name, persisted: true };
    }
  }
  noticeSessionOnly();
  return { id: uuid(), url: URL.createObjectURL(file), mimeType: mime, sizeBytes: file.size, name: file.name, persisted: false };
}
