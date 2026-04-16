import { Session, VerdictType } from '../types';
import { computeMedian } from './baseline';

/**
 * Weekly summary of HRV metrics and trends.
 */
export interface WeeklySummary {
  /** Average rMSSD for the week. */
  avgRmssd: number;
  /** Median rMSSD for the week. */
  medianRmssd: number;
  /** Average resting heart rate. */
  avgHr: number;
  /** Number of sessions recorded. */
  sessionCount: number;
  /** rMSSD trend direction relative to previous period. */
  trendDirection: 'improving' | 'stable' | 'declining';
  /** Percentage change from previous period. */
  trendPercent: number;
  /** Best rMSSD day. */
  bestDay: { date: string; rmssd: number } | null;
  /** Worst rMSSD day. */
  worstDay: { date: string; rmssd: number } | null;
  /** Verdict distribution. */
  verdictCounts: Record<VerdictType, number>;
  /** Longest consecutive-day streak in the period. */
  streakInPeriod: number;
}

/**
 * Computes a weekly summary from sessions.
 * @param currentSessions Sessions from the current 7-day period
 * @param previousSessions Sessions from the prior 7-day period (for trend)
 */
export function computeWeeklySummary(
  currentSessions: Session[],
  previousSessions: Session[]
): WeeklySummary {
  const currentRmssd = currentSessions.map((s) => s.rmssd);
  const previousRmssd = previousSessions.map((s) => s.rmssd);

  const avgRmssd =
    currentRmssd.length > 0 ? currentRmssd.reduce((sum, v) => sum + v, 0) / currentRmssd.length : 0;

  const medianRmssd = computeMedian(currentRmssd);

  const avgHr =
    currentSessions.length > 0
      ? currentSessions.reduce((sum, s) => sum + s.meanHr, 0) / currentSessions.length
      : 0;

  const prevAvg =
    previousRmssd.length > 0
      ? previousRmssd.reduce((sum, v) => sum + v, 0) / previousRmssd.length
      : 0;

  let trendDirection: WeeklySummary['trendDirection'] = 'stable';
  let trendPercent = 0;

  if (prevAvg > 0 && currentRmssd.length > 0) {
    trendPercent = ((avgRmssd - prevAvg) / prevAvg) * 100;
    if (trendPercent > 5) trendDirection = 'improving';
    else if (trendPercent < -5) trendDirection = 'declining';
  }

  let bestDay: WeeklySummary['bestDay'] = null;
  let worstDay: WeeklySummary['worstDay'] = null;

  for (const s of currentSessions) {
    const date = s.timestamp.slice(0, 10);
    if (!bestDay || s.rmssd > bestDay.rmssd) bestDay = { date, rmssd: s.rmssd };
    if (!worstDay || s.rmssd < worstDay.rmssd) worstDay = { date, rmssd: s.rmssd };
  }

  const verdictCounts: Record<VerdictType, number> = { go_hard: 0, moderate: 0, rest: 0 };
  for (const s of currentSessions) {
    if (s.verdict) verdictCounts[s.verdict]++;
  }

  const streakInPeriod = computeStreakInSessions(currentSessions);

  return {
    avgRmssd,
    medianRmssd,
    avgHr,
    sessionCount: currentSessions.length,
    trendDirection,
    trendPercent,
    bestDay,
    worstDay,
    verdictCounts,
    streakInPeriod,
  };
}

function computeStreakInSessions(sessions: Session[]): number {
  if (sessions.length === 0) return 0;
  const dates = [...new Set(sessions.map((s) => s.timestamp.slice(0, 10)))].sort();
  let maxStreak = 1;
  let current = 1;

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + 'T12:00:00');
    const curr = new Date(dates[i] + 'T12:00:00');
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      current++;
      maxStreak = Math.max(maxStreak, current);
    } else {
      current = 1;
    }
  }
  return maxStreak;
}

/**
 * Correlation between sleep quality and next-day rMSSD.
 * Returns null if insufficient data (<5 paired observations).
 */
export interface CorrelationResult {
  factor: string;
  correlation: number;
  sampleSize: number;
  interpretation: string;
}

export function computeSleepHrvCorrelation(sessions: Session[]): CorrelationResult | null {
  const pairs = sessions
    .filter((s) => s.sleepQuality !== null && s.sleepQuality !== undefined)
    .map((s) => ({ x: s.sleepQuality!, y: s.rmssd }));

  if (pairs.length < 5) return null;

  const r = pearsonCorrelation(
    pairs.map((p) => p.x),
    pairs.map((p) => p.y)
  );

  return {
    factor: 'Sleep Quality',
    correlation: r,
    sampleSize: pairs.length,
    interpretation:
      r > 0.3
        ? 'Better sleep → higher HRV'
        : r < -0.3
          ? 'Unexpected inverse relationship'
          : 'Weak or no clear relationship',
  };
}

export function computeStressHrvCorrelation(sessions: Session[]): CorrelationResult | null {
  const pairs = sessions
    .filter((s) => s.stressLevel !== null && s.stressLevel !== undefined)
    .map((s) => ({ x: s.stressLevel!, y: s.rmssd }));

  if (pairs.length < 5) return null;

  const r = pearsonCorrelation(
    pairs.map((p) => p.x),
    pairs.map((p) => p.y)
  );

  return {
    factor: 'Stress Level',
    correlation: r,
    sampleSize: pairs.length,
    interpretation:
      r < -0.3
        ? 'Higher stress → lower HRV'
        : r > 0.3
          ? 'Unexpected positive relationship'
          : 'Weak or no clear relationship',
  };
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;

  const sumX = x.reduce((s, v) => s + v, 0);
  const sumY = y.reduce((s, v) => s + v, 0);
  const sumXY = x.reduce((s, v, i) => s + v * y[i], 0);
  const sumX2 = x.reduce((s, v) => s + v * v, 0);
  const sumY2 = y.reduce((s, v) => s + v * v, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));

  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100) / 100;
}
