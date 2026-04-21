/**
 * Weekly and monthly analytics: trend detection, correlations, and summaries.
 *
 * Pure functions that operate on arrays of {@link Session} objects and
 * produce structured analytics results — trend direction, period-over-period
 * comparisons, sleep/stress correlation insights, and verdict distribution.
 */
import { Session, VerdictType } from '../types';
import { computeMedian } from './baseline';

/**
 * Trend direction is "improving"/"declining" only when the period-over-period
 * change exceeds this magnitude (in percentage points). Avoids labelling 1%
 * noise as a trend.
 */
const TREND_THRESHOLD_PCT = 5;
/** Minimum paired observations required to compute a correlation. */
const MIN_CORRELATION_SAMPLES = 5;
/** |r| above this is treated as a meaningful linear relationship. */
const SIGNIFICANT_CORRELATION_THRESHOLD = 0.3;
/** Inclusive day-gap that counts as "consecutive" for streak counting. */
const CONSECUTIVE_DAY_GAP = 1;
const MS_PER_DAY = 86_400_000;

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
 * @returns WeeklySummary with averages, trend, verdicts, and streak.
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
    if (trendPercent > TREND_THRESHOLD_PCT) trendDirection = 'improving';
    else if (trendPercent < -TREND_THRESHOLD_PCT) trendDirection = 'declining';
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
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / MS_PER_DAY);
    if (diffDays === CONSECUTIVE_DAY_GAP) {
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
 * @returns CorrelationResult or null if fewer than 5 paired observations.
 * Returns null if insufficient data (< {@link MIN_CORRELATION_SAMPLES} paired observations).
 */
export interface CorrelationResult {
  factor: string;
  correlation: number;
  sampleSize: number;
  interpretation: string;
}

interface CorrelationInterpretations {
  /** Shown when r > +SIGNIFICANT_CORRELATION_THRESHOLD. */
  positive: string;
  /** Shown when r < -SIGNIFICANT_CORRELATION_THRESHOLD. */
  negative: string;
  /** Shown otherwise. */
  weak: string;
}

function computeFactorCorrelation(
  sessions: Session[],
  factor: string,
  selector: (s: Session) => number | null | undefined,
  interpretations: CorrelationInterpretations
): CorrelationResult | null {
  const pairs = sessions
    .map((s) => ({ x: selector(s), y: s.rmssd }))
    .filter((p): p is { x: number; y: number } => p.x !== null && p.x !== undefined);

  if (pairs.length < MIN_CORRELATION_SAMPLES) return null;

  const r = pearsonCorrelation(
    pairs.map((p) => p.x),
    pairs.map((p) => p.y)
  );

  let interpretation: string;
  if (r > SIGNIFICANT_CORRELATION_THRESHOLD) interpretation = interpretations.positive;
  else if (r < -SIGNIFICANT_CORRELATION_THRESHOLD) interpretation = interpretations.negative;
  else interpretation = interpretations.weak;

  return { factor, correlation: r, sampleSize: pairs.length, interpretation };
}

export function computeSleepHrvCorrelation(sessions: Session[]): CorrelationResult | null {
  return computeFactorCorrelation(sessions, 'Sleep Quality', (s) => s.sleepQuality, {
    positive: 'Better sleep → higher HRV',
    negative: 'Unexpected inverse relationship',
    weak: 'Weak or no clear relationship',
  });
}

/**
 * Correlation between stress level and rMSSD.
 * @returns CorrelationResult or null if insufficient data.
 */
export function computeStressHrvCorrelation(sessions: Session[]): CorrelationResult | null {
  return computeFactorCorrelation(sessions, 'Stress Level', (s) => s.stressLevel, {
    positive: 'Unexpected positive relationship',
    negative: 'Higher stress → lower HRV',
    weak: 'Weak or no clear relationship',
  });
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
