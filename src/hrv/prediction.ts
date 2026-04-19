/**
 * On-device HRV trend prediction.
 *
 * Predicts next-day rMSSD and likely verdict using:
 *   - Linear regression on the 7-day rMSSD trend
 *   - TSB (Training Stress Balance) trajectory
 *   - Day-of-week pattern (if sufficient history)
 *
 * All computation is local — no cloud, no ML model downloads.
 */
import { Session, VerdictType, BaselineResult } from '../types';
import { getLatestTsb, TsbPoint, classifyTsb } from './trainingStress';

export interface PredictionResult {
  /** Predicted rMSSD for tomorrow (ms). */
  predictedRmssd: number;
  /** Likely verdict based on predicted rMSSD vs baseline. */
  likelyVerdict: VerdictType;
  /** Confidence: 'low' (< 14 days), 'medium' (14–30 days), 'high' (> 30 days). */
  confidence: 'low' | 'medium' | 'high';
  /** One-sentence human-readable rationale. */
  rationale: string;
  /** Number of days of history used. */
  historyDays: number;
}

/** Minimum days of data before prediction is attempted. */
export const MIN_DAYS_FOR_PREDICTION = 7;

/**
 * Simple linear regression: y = slope * x + intercept.
 */
function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/**
 * Predicts the next-day rMSSD and likely verdict.
 *
 * @param recentSessions Last 7–60 days of sessions, ordered by date ascending.
 * @param baseline Current rolling baseline.
 * @param goHardThreshold Ratio threshold for "go_hard" (default 0.95).
 * @param moderateThreshold Ratio threshold for "moderate" (default 0.80).
 * @returns PredictionResult with predicted rMSSD, verdict, confidence, and rationale. Null if < 7 days of history.
 */
export function predictNextDay(
  recentSessions: Session[],
  baseline: BaselineResult,
  goHardThreshold: number = 0.95,
  moderateThreshold: number = 0.8
): PredictionResult | null {
  // Need at least MIN_DAYS_FOR_PREDICTION distinct days
  const dailyRmssd = extractDailyRmssd(recentSessions);
  if (dailyRmssd.length < MIN_DAYS_FOR_PREDICTION) return null;
  if (baseline.median <= 0) return null;

  // Linear regression on last 7 days
  const last7 = dailyRmssd.slice(-7);
  const { slope, intercept } = linearRegression(last7.map((d) => d.rmssd));

  // Extrapolate one day forward
  let predicted = intercept + slope * last7.length;

  // TSB adjustment: if TSB is very negative (fatigued), pull prediction down
  const tsb = getLatestTsb(recentSessions);
  if (tsb && tsb.tsb < -15) {
    const fatigueFactor = Math.max(0.85, 1 + tsb.tsb * 0.003);
    predicted *= fatigueFactor;
  } else if (tsb && tsb.tsb > 15) {
    // Very fresh → small boost
    predicted *= Math.min(1.05, 1 + tsb.tsb * 0.001);
  }

  // Clamp to physiologically plausible range
  predicted = Math.max(5, Math.min(200, predicted));
  predicted = Math.round(predicted * 10) / 10;

  // Determine likely verdict
  const ratio = predicted / baseline.median;
  let likelyVerdict: VerdictType;
  if (ratio >= goHardThreshold) likelyVerdict = 'go_hard';
  else if (ratio >= moderateThreshold) likelyVerdict = 'moderate';
  else likelyVerdict = 'rest';

  // Confidence based on history depth
  const historyDays = dailyRmssd.length;
  let confidence: PredictionResult['confidence'];
  if (historyDays >= 30) confidence = 'high';
  else if (historyDays >= 14) confidence = 'medium';
  else confidence = 'low';

  // Build rationale
  const rationale = buildRationale(slope, tsb, likelyVerdict, predicted, baseline.median);

  return {
    predictedRmssd: predicted,
    likelyVerdict,
    confidence,
    rationale,
    historyDays,
  };
}

function extractDailyRmssd(sessions: Session[]): { date: string; rmssd: number }[] {
  const byDate = new Map<string, number>();
  for (const s of sessions) {
    const date = s.timestamp.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, s.rmssd);
  }
  return [...byDate.entries()]
    .map(([date, rmssd]) => ({ date, rmssd }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildRationale(
  slope: number,
  tsb: TsbPoint | null,
  verdict: VerdictType,
  predicted: number,
  baselineMedian: number
): string {
  const parts: string[] = [];

  if (slope > 0.5) parts.push('Your HRV is trending upward');
  else if (slope < -0.5) parts.push('Your HRV is trending downward');
  else parts.push('Your HRV trend is stable');

  if (tsb) {
    const zone = classifyTsb(tsb.tsb);
    if (zone === 'fresh') parts.push('and your training balance shows good recovery');
    else if (zone === 'fatigued') parts.push('but your training load is accumulating');
    else if (zone === 'overreaching') parts.push('and fatigue is significant — rest is critical');
  }

  const pct = Math.round((predicted / baselineMedian) * 100);
  const verdictLabel =
    verdict === 'go_hard' ? 'Go Hard' : verdict === 'moderate' ? 'Moderate' : 'Rest';
  parts.push(`— forecasting ${verdictLabel} (${pct}% of baseline).`);

  return parts.join(' ');
}
