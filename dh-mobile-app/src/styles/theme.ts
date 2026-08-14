export type ColorPalette = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  gradientStart: string;
  gradientEnd: string;

  background: string;
  surface: string;
  card: string;

  text: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;

  border: string;
  inputBg: string;

  success: string;
  warning: string;
  danger: string;
  info: string;

  shadow: string;

  tintPrimary: string;
  tintSuccess: string;
  tintDanger: string;
  tintWarning: string;
  tintPurple: string;
  tintRose: string;
  tintSelected: string;
  tintNeutral: string;
};

export const lightColors: ColorPalette = {
  primary: '#4F46E5',
  primaryDark: '#4338CA',
  primaryLight: '#6366F1',
  accent: '#06B6D4',
  gradientStart: '#4F46E5',
  gradientEnd: '#7C3AED',

  background: '#F5F7FB',
  surface: '#FFFFFF',
  card: '#FFFFFF',

  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textOnPrimary: '#FFFFFF',

  border: '#E2E8F0',
  inputBg: '#F1F5F9',

  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',

  shadow: '#0F172A',

  tintPrimary: '#E0E7FF',
  tintSuccess: '#DCFCE7',
  tintDanger: '#FEE2E2',
  tintWarning: '#FEF3C7',
  tintPurple: '#EDE9FE',
  tintRose: '#FFE4E6',
  tintSelected: '#EEF2FF',
  tintNeutral: '#F3F4F6',
};

export const darkColors: ColorPalette = {
  primary: '#818CF8',
  primaryDark: '#6366F1',
  primaryLight: '#A5B4FC',
  accent: '#22D3EE',
  gradientStart: '#4F46E5',
  gradientEnd: '#7C3AED',

  background: '#0B1220',
  surface: '#151C2C',
  card: '#151C2C',

  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textOnPrimary: '#FFFFFF',

  border: '#334155',
  inputBg: '#1E293B',

  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
  info: '#60A5FA',

  shadow: '#000000',

  tintPrimary: '#312E81',
  tintSuccess: '#14532D',
  tintDanger: '#7F1D1D',
  tintWarning: '#78350F',
  tintPurple: '#4C1D95',
  tintRose: '#881337',
  tintSelected: '#312E81',
  tintNeutral: '#1F2937',
};

export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  h1: { fontSize: 30, fontWeight: '700' as const, lineHeight: 38 },
  h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  title: { fontSize: 17, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600' as const, lineHeight: 18 },
} as const;

export type ShadowTokens = {
  card: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  soft: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
};

export function createShadow(palette: ColorPalette): ShadowTokens {
  return {
    card: {
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: palette === darkColors ? 0.35 : 0.08,
      shadowRadius: 16,
      elevation: 4,
    },
    soft: {
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: palette === darkColors ? 0.28 : 0.06,
      shadowRadius: 10,
      elevation: 2,
    },
  };
}

export const shadow = createShadow(lightColors);

export const theme = { colors, spacing, radius, typography, shadow };
export type Theme = typeof theme;
export type ColorScheme = 'light' | 'dark';
export type ThemePreference = 'system' | ColorScheme;

export function getPalette(scheme: ColorScheme): ColorPalette {
  return scheme === 'dark' ? darkColors : lightColors;
}
