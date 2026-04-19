import { HrvMetrics } from '../types';
import { computeHrvMetrics } from './metrics';

/**
 * Orthostatic response thresholds (from Buchheit / Plews HRV monitoring literature).
 *
 * A healthy autonomic response shows ~OPTIMAL_RMSSD_DROP_PCT % rMSSD drop and
 * ~OPTIMAL_HR_RISE bpm HR rise on standing. The penalty multipliers convert
 * "distance from optimal" into a 0–100 reactivity score.
 */
const OPTIMAL_RMSSD_DROP_PCT = 25;
const OPTIMAL_HR_RISE_BPM = 15;
/** Per-percentage-point penalty applied to rmssd reactivity score. */
const RMSSD_DROP_PENALTY_PER_PP = 3;
/** Per-bpm penalty applied to HR reactivity score. */
const HR_RISE_PENALTY_PER_BPM = 4;
/** Composite reactivity-score weights (HRV-heavier per the literature). */
const RMSSD_REACTIVITY_WEIGHT = 0.6;
const HR_REACTIVITY_WEIGHT = 0.4;

/** Interpretation cutoffs. */
const BLUNTED_RMSSD_DROP_PCT = 10;
const BLUNTED_HR_RISE_BPM = 5;
const EXAGGERATED_RMSSD_DROP_PCT = 50;
const EXAGGERATED_HR_RISE_BPM = 35;
const NORMAL_RMSSD_DROP_RANGE = { min: 15, max: 40 };
const NORMAL_HR_RISE_RANGE = { min: 10, max: 30 };

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Computes orthostatic test results from supine and standing RR intervals.
 *
 * A healthy autonomic response shows:
 *   - rMSSD drop of {@link NORMAL_RMSSD_DROP_RANGE} % from supine to standing
 *   - HR increase of {@link NORMAL_HR_RISE_RANGE} bpm
 *
 * Blunted response (small HR/rMSSD change) may indicate overtraining.
 * Exaggerated response may indicate dehydration or acute fatigue.
 * @returns OrthostaticResult with supine/standing metrics, reactivity score, and interpretation.
 */
export function computeOrthostaticResult(
  supineRrIntervals: number[],
  standingRrIntervals: number[]
): OrthostaticResult {
  const supine = computeHrvMetrics(supineRrIntervals);
  const standing = computeHrvMetrics(standingRrIntervals);

  const deltaRmssd = standing.rmssd - supine.rmssd;
  const deltaHr = standing.meanHr - supine.meanHr;

  const rmssdDropPct = supine.rmssd > 0 ? Math.abs(deltaRmssd / supine.rmssd) * 100 : 0;

  const rmssdScore = clamp(
    100 - Math.abs(rmssdDropPct - OPTIMAL_RMSSD_DROP_PCT) * RMSSD_DROP_PENALTY_PER_PP,
    0,
    100
  );
  const hrScore = clamp(
    100 - Math.abs(deltaHr - OPTIMAL_HR_RISE_BPM) * HR_RISE_PENALTY_PER_BPM,
    0,
    100
  );
  const reactivityScore = Math.round(
    rmssdScore * RMSSD_REACTIVITY_WEIGHT + hrScore * HR_REACTIVITY_WEIGHT
  );

  let interpretation: string;
  if (rmssdDropPct < BLUNTED_RMSSD_DROP_PCT && deltaHr < BLUNTED_HR_RISE_BPM) {
    interpretation = 'Blunted response — possible overtraining or parasympathetic dominance';
  } else if (rmssdDropPct > EXAGGERATED_RMSSD_DROP_PCT || deltaHr > EXAGGERATED_HR_RISE_BPM) {
    interpretation = 'Exaggerated response — possible dehydration, fatigue, or illness';
  } else if (
    rmssdDropPct >= NORMAL_RMSSD_DROP_RANGE.min &&
    rmssdDropPct <= NORMAL_RMSSD_DROP_RANGE.max &&
    deltaHr >= NORMAL_HR_RISE_RANGE.min &&
    deltaHr <= NORMAL_HR_RISE_RANGE.max
  ) {
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
