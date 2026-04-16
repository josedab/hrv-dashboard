/**
 * Centralized color palette for the dark-themed UI.
 * Verdict colors match the standard green/amber/red readiness system.
 */
export const COLORS = {
  // Verdict colors
  goHard: '#22C55E', // green
  moderate: '#F59E0B', // amber
  rest: '#EF4444', // red
  noVerdict: '#94A3B8', // slate gray

  // UI colors
  background: '#0F172A', // dark navy
  surface: '#1E293B', // slightly lighter
  surfaceLight: '#334155',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#7E8CA8',
  accent: '#3B82F6', // blue
  border: '#334155',
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',
} as const;

/** Maps each verdict type to its display color. */
export const VERDICT_COLORS: Record<string, string> = {
  go_hard: COLORS.goHard,
  moderate: COLORS.moderate,
  rest: COLORS.rest,
};
