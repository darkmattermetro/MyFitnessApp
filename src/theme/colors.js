// Design tokens. Colours live in two palettes and are selected at runtime by
// src/theme/ThemeContext.js (Dark / Light / follow system).

export const darkColors = {
  primary: '#34D399',
  primaryDark: '#6EE7B7',
  primarySoft: '#123A2B',
  primaryTrack: '#183A2C',
  primaryGradient: ['#0F9F6E', '#07583F'],
  background: '#0B1114',
  surface: '#141C20',
  surfaceMuted: '#1B252B',
  surfaceHover: '#1A3026',
  text: '#EDF4F1',
  textMuted: '#A0ADA9',
  border: '#29363B',
  borderStrong: '#3A4A4F',
  danger: '#FF7373',
  dangerSoft: '#3A2024',
  warning: '#FBBF5A',
  warningSoft: '#3A2D18',
  white: '#FFFFFF',
};

export const lightColors = {
  primary: '#0F9F6E',
  primaryDark: '#0B7A54',
  primarySoft: '#DCF5EA',
  primaryTrack: '#D7EBE2',
  primaryGradient: ['#0F9F6E', '#087A56'],
  background: '#F4F7F5',
  surface: '#FFFFFF',
  surfaceMuted: '#EDF2EF',
  surfaceHover: '#E3F2EB',
  text: '#0F1F1A',
  textMuted: '#5B6B65',
  border: '#DCE6E1',
  borderStrong: '#C2D0C9',
  danger: '#B3261E',
  dangerSoft: '#FBE4E0',
  warning: '#8A5300',
  warningSoft: '#FDF0D5',
  white: '#FFFFFF',
};

export const palettes = {
  dark: darkColors,
  light: lightColors,
};

// Kept for backwards compatibility. Prefer useTheme().colors in components so
// styles react to the selected theme.
export const colors = darkColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
};

export const font = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  hero: 40,
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
};
