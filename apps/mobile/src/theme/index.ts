import { useColorScheme } from 'react-native';

export type ColorScheme = 'dark' | 'light';

const dark = {
  background: '#0A0B0D',
  surface: '#141619',
  surfaceElevated: '#1C1F23',
  surfaceMuted: '#22262B',
  border: '#2A2E34',
  text: '#F4F5F6',
  textSecondary: '#A1A7B0',
  textMuted: '#6B727C',
  accent: '#C6FF3D',
  accentPressed: '#B2EB28',
  accentSoft: 'rgba(198,255,61,0.14)',
  onAccent: '#0A0B0D',
  success: '#34D399',
  successSoft: 'rgba(52,211,153,0.15)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251,191,36,0.15)',
  danger: '#F87171',
  dangerSoft: 'rgba(248,113,113,0.15)',
  info: '#60A5FA',
  infoSoft: 'rgba(96,165,250,0.15)',
  overlay: 'rgba(0,0,0,0.6)',
  chartGrid: '#24282D',
};

const light: typeof dark = {
  background: '#F5F6F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#EEF0F2',
  border: '#E2E5E9',
  text: '#0D0F12',
  textSecondary: '#4B525C',
  textMuted: '#8A919B',
  accent: '#7BC400',
  accentPressed: '#6AAA00',
  accentSoft: 'rgba(123,196,0,0.14)',
  onAccent: '#0A0B0D',
  success: '#059669',
  successSoft: 'rgba(5,150,105,0.12)',
  warning: '#D97706',
  warningSoft: 'rgba(217,119,6,0.12)',
  danger: '#DC2626',
  dangerSoft: 'rgba(220,38,38,0.1)',
  info: '#2563EB',
  infoSoft: 'rgba(37,99,235,0.1)',
  overlay: 'rgba(0,0,0,0.45)',
  chartGrid: '#E8EAED',
};

export const palettes = { dark, light };
export type Colors = typeof dark;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.8 },
  h1: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  number: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
};

export interface Theme {
  scheme: ColorScheme;
  colors: Colors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
}

export function useTheme(): Theme {
  const scheme: ColorScheme = useColorScheme() === 'light' ? 'light' : 'dark';
  return { scheme, colors: palettes[scheme], spacing, radius, typography };
}

/** Largura máxima do conteúdo em tablets/web. */
export const MAX_CONTENT_WIDTH = 760;
