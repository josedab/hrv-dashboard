/**
 * Adaptive per-user readiness thresholds.
 *
 * Replaces the fixed 95% / 80% rMSSD-vs-baseline cutoffs with personal
 * percentile cutoffs derived from each user's own rolling distribution.
 * When perceived-readiness labels are available (LogScreen), a Bayesian
 * update nudges the boundary toward the label.
 *
 * Shipped behind the `verdictMode` user setting (default `fixed`).
 *
 * Cold-start (< {@link MIN_HISTORY_DAYS}): falls back to fixed
 * thresholds, exposed via {@link AdaptiveResult.coldStart}.
 */
import { Session, VerdictType, BaselineResult, Settings } from '../types';

export interface AdaptiveThresholds {
  /** Lower-tail percentile that maps to "rest" (default 0.20 = 20th pct). */
  restPercentile: number;
  /** Upper-tail percentile that maps to "go_hard" (default 0.65 = 65th pct). */
  hardPercentile: number;
  /** Required prior days of clean sessions before adaptation kicks in. */
  minHistoryDays: number;
}

export const DEFAULT_ADAPTIVE: AdaptiveThresholds = {
  restPercentile: 0.2,
  hardPercentile: 0.65,
  minHistoryDays: 30,
};

export interface AdaptiveResult {
  verdict: VerdictType | null;
  /** Resolved cutoffs in absolute rMSSD ms. */
  cutoffs: { rest: number; hard: number };
  coldStart: boolean;
  /** Number of historical sessions that fed the percentile fit. */
  historyN: number;
}

/** @returns The p-th percentile value. 0 for empty input. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

/**
 * Compute the adaptive verdict for a single morning reading.
 *
 * Uses up to the last 60 days of chest-strap sessions (camera excluded
 * upstream) to fit personal cutoffs. Optionally accepts perceived-
 * readiness labels (1–5) and shifts cutoffs toward the user's reported
 * subjective state via a small Bayesian bump (capped at ±10%).
 * @returns AdaptiveResult with verdict, cutoffs, cold-start flag, and history count.
 */
export function computeAdaptiveVerdict(
  currentRmssd: number,
  history: Session[],
  fallbackBaseline: BaselineResult,
  fallbackSettings: Pick<Settings, 'goHardThreshold' | 'moderateThreshold'>,
  thresholds: AdaptiveThresholds = DEFAULT_ADAPTIVE
): AdaptiveResult {
  const distinctDays = new Set(
    history.map((s) => new Date(s.timestamp).toISOString().slice(0, 10))
  );

  if (distinctDays.size < thresholds.minHistoryDays || fallbackBaseline.median === 0) {
    if (fallbackBaseline.dayCount < 5 || fallbackBaseline.median === 0) {
      return {
        verdict: null,
        cutoffs: { rest: 0, hard: 0 },
        coldStart: true,
        historyN: distinctDays.size,
      };
    }
    const restCutoff = fallbackBaseline.median * fallbackSettings.moderateThreshold;
    const hardCutoff = fallbackBaseline.median * fallbackSettings.goHardThreshold;
    let v: VerdictType = 'rest';
    if (currentRmssd >= hardCutoff) v = 'go_hard';
    else if (currentRmssd >= restCutoff) v = 'moderate';
    return {
      verdict: v,
      cutoffs: { rest: restCutoff, hard: hardCutoff },
      coldStart: true,
      historyN: distinctDays.size,
    };
  }

  const rmssdValues = history.map((s) => s.rmssd).filter((v) => v > 0);
  let restCutoff = percentile(rmssdValues, thresholds.restPercentile);
  let hardCutoff = percentile(rmssdValues, thresholds.hardPercentile);

  // Bayesian-lite label feedback: if recent sessions were systematically
  // labeled "easier than the verdict said", lower both cutoffs (and vice
  // versa). Bounded to ±10% to prevent drift on noisy labels.
  const labeled = history.filter((s) => s.perceivedReadiness !== null);
  if (labeled.length >= 10) {
    let bias = 0;
    for (const s of labeled) {
      const label = s.perceivedReadiness ?? 3;
      const expected = s.verdict === 'go_hard' ? 4 : s.verdict === 'moderate' ? 3 : 2;
      bias += label - expected;
    }
    const meanBias = bias / labeled.length;
    const adjust = Math.max(-0.1, Math.min(0.1, meanBias * 0.04));
    restCutoff = restCutoff * (1 - adjust);
    hardCutoff = hardCutoff * (1 - adjust);
  }

  let verdict: VerdictType = 'rest';
  if (currentRmssd >= hardCutoff) verdict = 'go_hard';
  else if (currentRmssd >= restCutoff) verdict = 'moderate';

  return {
    verdict,
    cutoffs: { rest: restCutoff, hard: hardCutoff },
    coldStart: false,
    historyN: distinctDays.size,
  };
}
