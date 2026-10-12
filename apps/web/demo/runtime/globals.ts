/**
 * Substitutos injetados em tempo de build (ver build.mjs) no código de
 * apps/web/src para APIs do navegador que não funcionam no frame de hospedagem:
 * window.location/history (rotas por hash), confirm() (diálogo próprio),
 * download de arquivo (modal com o JSON) e a imagem do QR Code do convite.
 */
import QRCode from 'qrcode';
import { getLocation, navigate, resolveHref, toHref } from './router';
import { openConfirm, openExport } from './ui-store';

/** Base dos links "compartilháveis" gerados pelo app (convites). */
export const demoAppUrl = () => {
  try {
    if (/^https?:$/.test(window.location.protocol)) return `${window.location.href.split('#')[0]}#`;
  } catch {
    /* frame sem origem (about:srcdoc) */
  }
  return 'https://personalpro.app/#';
};

export const __demoLocation = {
  get pathname() {
    return getLocation().pathname;
  },
  get search() {
    return getLocation().search;
  },
  get hash() {
    return getLocation().hash;
  },
  get origin() {
    return demoAppUrl();
  },
  get href() {
    return demoAppUrl() + toHref(getLocation());
  },
  set href(v: string) {
    navigate(v.startsWith(demoAppUrl()) ? v.slice(demoAppUrl().length) : v, { replace: true });
  },
  assign(v: string) {
    navigate(v);
  },
  replace(v: string) {
    navigate(v, { replace: true });
  },
};

export const __demoHistory = {
  replaceState(_state: unknown, _title: string, url?: string | URL | null) {
    if (url === undefined || url === null) return;
    const loc = resolveHref(String(url));
    navigate(toHref(loc), { replace: true, scroll: false });
  },
  pushState(_state: unknown, _title: string, url?: string | URL | null) {
    if (url === undefined || url === null) return;
    navigate(String(url), { scroll: false });
  },
  back() {
    window.history.back();
  },
};

/**
 * confirm(msg) && acao() vira __demoConfirm(msg, () => acao()): abre um diálogo
 * no próprio app (confirm() nativo retorna false no frame de hospedagem).
 */
export function __demoConfirm(message: unknown, onConfirm: () => unknown): false {
  openConfirm(String(message ?? ''), onConfirm);
  return false;
}

/** Exportação LGPD: mostra o JSON num modal com botão de copiar. */
export function __demoDownloadJson(data: unknown, filename: string): Promise<void> {
  return openExport(JSON.stringify(data, null, 2), filename);
}

const qrCache = new Map<string, string>();
/** Imagem do QR Code do convite gerada no navegador (SVG em data URL). */
export function __demoQrUrl(code: string): string {
  const key = String(code);
  const hit = qrCache.get(key);
  if (hit) return hit;
  const text = `${demoAppUrl()}/convite/${key}`;
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const margin = 2;
    let path = '';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (qr.modules.get(x, y)) path += `M${x + margin} ${y + margin}h1v1h-1z`;
      }
    }
    const dim = size + margin * 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    qrCache.set(key, url);
    return url;
  } catch {
    return '';
  }
}
