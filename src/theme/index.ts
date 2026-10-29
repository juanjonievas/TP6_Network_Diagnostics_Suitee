export const Colors = {
  primary: '#1a56db',
  primaryDark: '#1e429f',
  primaryLight: '#ebf5ff',
  secondary: '#0e9f6e',
  background: '#f9fafb',
  surface: '#ffffff',
  surfaceCard: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  borderDark: '#d1d5db',
  success: '#057a55',
  successBg: '#def7ec',
  warning: '#c27803',
  warningBg: '#fef08a',
  danger: '#e02424',
  dangerBg: '#fde8e8',
  terminalBg: '#111827',
  terminalText: '#48bb78',
  terminalHeader: '#1f2937',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const Typography = {
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  body: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
};
