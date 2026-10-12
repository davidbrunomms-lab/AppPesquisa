export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3333').replace(/\/+$/, '');

export const GOOGLE_CLIENT_IDS = {
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
};

export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || 'http://localhost:3000/privacidade';
export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL || 'http://localhost:3000/termos';

/** Converte URLs relativas (ex.: /uploads/...) em absolutas. */
export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(https?:|data:|file:|blob:)/.test(url)) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}
