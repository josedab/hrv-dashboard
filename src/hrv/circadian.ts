/**
 * Circadian rhythm analysis for recording consistency.
 *
 * Analyzes when users take their HRV readings and correlates
 * time-of-day variation with measurement quality. Recommends an
 * optimal recording window based on the user's own data.
 */
import { Session } from '../types';

export interface CircadianAnalysis {
  /** Average recording time as minutes-from-midnight. */
  avgTimeMinutes: number;
  /** Formatted average time (HH:MM). */
  avgTimeFormatted: string;
  /** Standard deviation of recording times in minutes. */
  stdDevMinutes: number;
  /** Consistency score 0–100 (lower stddev = higher score). */
  consistencyScore: number;
  /** Recommended recording window (start, end in HH:MM). */
  optimalWindow: { start: string; end: string };
  /** Per-hour distribution (0–23) showing how many readings per hour. */
  hourDistribution: number[];
  /** Whether the user is consistent enough for reliable data. */
  isConsistent: boolean;
  /** Human-readable advice. */
  advice: string;
}

/** Minimum sessions needed for meaningful analysis. */
export const MIN_SESSIONS_FOR_CIRCADIAN = 7;
/** Maximum stddev (minutes) to be considered "consistent". */
const CONSISTENCY_THRESHOLD_MINUTES = 45;

/**
 * Analyzes recording time patterns from session timestamps.
 * @returns CircadianAnalysis or null if fewer than 7 sessions.
 */
export function analyzeCircadian(sessions: Session[]): CircadianAnalysis | null {
  if (sessions.length < MIN_SESSIONS_FOR_CIRCADIAN) return null;

  const minutesOfDay = sessions.map((s) => {
    const d = new Date(s.timestamp);
    return d.getHours() * 60 + d.getMinutes();
  });

  const avg = minutesOfDay.reduce((s, v) => s + v, 0) / minutesOfDay.length;

  const variance = minutesOfDay.reduce((s, v) => s + (v - avg) ** 2, 0) / minutesOfDay.length;
  const stdDev = Math.sqrt(variance);

  // Consistency score: 100 at 0 stddev, 0 at 120 minutes stddev
  const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - (stdDev / 120) * 100)));
  const isConsistent = stdDev <= CONSISTENCY_THRESHOLD_MINUTES;

  // Optimal window: avg ± 15 minutes
  const windowStart = Math.max(0, Math.round(avg - 15));
  const windowEnd = Math.min(24 * 60 - 1, Math.round(avg + 15));

  // Hour distribution
  const hourDistribution = new Array(24).fill(0);
  for (const m of minutesOfDay) {
    hourDistribution[Math.floor(m / 60)]++;
  }

  const advice = buildAdvice(isConsistent, stdDev, avg);

  return {
    avgTimeMinutes: Math.round(avg),
    avgTimeFormatted: formatMinutes(Math.round(avg)),
    stdDevMinutes: Math.round(stdDev),
    consistencyScore,
    optimalWindow: {
      start: formatMinutes(windowStart),
      end: formatMinutes(windowEnd),
    },
    hourDistribution,
    isConsistent,
    advice,
  };
}

function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildAdvice(isConsistent: boolean, stdDev: number, avgMinutes: number): string {
  const timeStr = formatMinutes(Math.round(avgMinutes));

  if (isConsistent) {
    return `Great consistency! Your readings around ${timeStr} produce the most reliable data. Keep it up.`;
  }

  if (stdDev > 90) {
    return `Your recording times vary by over 90 minutes. Try to measure at the same time each morning (ideally around ${timeStr}) for more comparable data.`;
  }

  return `Your recordings are somewhat scattered (±${Math.round(stdDev)} min). Aim for ${timeStr} each morning to improve data consistency.`;
}

/**
 * Correlates recording time-of-day with HRV values.
 * @returns Correlation coefficient and insight string, or null.
 */
export function correlateTimeWithHrv(
  sessions: Session[]
): { correlation: number; insight: string } | null {
  if (sessions.length < MIN_SESSIONS_FOR_CIRCADIAN) return null;

  const pairs = sessions.map((s) => {
    const d = new Date(s.timestamp);
    return { minutes: d.getHours() * 60 + d.getMinutes(), rmssd: s.rmssd };
  });

  const n = pairs.length;
  const sumX = pairs.reduce((s, p) => s + p.minutes, 0);
  const sumY = pairs.reduce((s, p) => s + p.rmssd, 0);
  const sumXY = pairs.reduce((s, p) => s + p.minutes * p.rmssd, 0);
  const sumX2 = pairs.reduce((s, p) => s + p.minutes ** 2, 0);
  const sumY2 = pairs.reduce((s, p) => s + p.rmssd ** 2, 0);

  const denom = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
  if (denom === 0) return { correlation: 0, insight: 'Not enough variation to analyze.' };

  const r = Math.round(((n * sumXY - sumX * sumY) / denom) * 100) / 100;

  let insight: string;
  if (Math.abs(r) < 0.2) {
    insight = 'Recording time has minimal effect on your HRV — good news for schedule flexibility.';
  } else if (r > 0) {
    insight =
      'Later recordings tend to show higher HRV. Morning measurements may catch residual sleep inertia.';
  } else {
    insight =
      'Earlier recordings tend to show higher HRV — your morning window captures peak parasympathetic tone.';
  }

  return { correlation: r, insight };
}
