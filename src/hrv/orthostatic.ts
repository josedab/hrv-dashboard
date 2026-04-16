import { HrvMetrics } from '../types';
import { computeHrvMetrics } from './metrics';

/**
 * Result of an orthostatic HRV test.
 * Compares supine (lying) vs. standing HRV metrics.
 */
export interface OrthostaticResult {
  supine: HrvMetrics;
  standing: HrvMetrics;
  /** Change in rMSSD from supine to standing. Typically negative. */
  deltaRmssd: number;
  /** Change in mean HR from supine to standing. Typically positive. */
  deltaHr: number;
  /** Reactivity score 0–100. Higher = more responsive autonomic system. */
  reactivityScore: number;
  /** Interpretation of the reactivity. */
  interpretation: string;
}

/**
 * Computes orthostatic test results from supine and standing RR intervals.
 *
 * A healthy autonomic response shows:
 *   - rMSSD drop of 15-40% from supine to standing
 *   - HR increase of 10-30 bpm
 *
 * Blunted response (small HR/rMSSD change) may indicate overtraining.
 * Exaggerated response may indicate dehydration or acute fatigue.
 */
export function computeOrthostaticResult(
  supineRrIntervals: number[],
  standingRrIntervals: number[]
): OrthostaticResult {
  const supine = computeHrvMetrics(supineRrIntervals);
  const standing = computeHrvMetrics(standingRrIntervals);

  const deltaRmssd = standing.rmssd - supine.rmssd;
  const deltaHr = standing.meanHr - supine.meanHr;

  const rmssdDropPct = supine.rmssd > 0
    ? Math.abs(deltaRmssd / supine.rmssd) * 100
    : 0;

  // Reactivity score: optimal is ~25% rMSSD drop + ~15bpm HR rise
  // Weights: 60% HRV reactivity, 40% HR reactivity
  const rmssdScore = Math.max(0, Math.min(100, 100 - Math.abs(rmssdDropPct - 25) * 3));
  const hrScore = Math.max(0, Math.min(100, 100 - Math.abs(deltaHr - 15) * 4));
  const reactivityScore = Math.round(rmssdScore * 0.6 + hrScore * 0.4);

  let interpretation: string;
  if (rmssdDropPct < 10 && deltaHr < 5) {
    interpretation = 'Blunted response — possible overtraining or parasympathetic dominance';
  } else if (rmssdDropPct > 50 || deltaHr > 35) {
    interpretation = 'Exaggerated response — possible dehydration, fatigue, or illness';
  } else if (rmssdDropPct >= 15 && rmssdDropPct <= 40 && deltaHr >= 10 && deltaHr <= 30) {
    interpretation = 'Normal autonomic reactivity — healthy response to postural change';
  } else {
    interpretation = 'Atypical response — consider monitoring trend over multiple days';
  }

  return {
    supine,
    standing,
    deltaRmssd,
    deltaHr,
    reactivityScore,
    interpretation,
  };
}
