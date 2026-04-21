/**
 * Readiness verdict computation (fixed + adaptive paths).
 *
 * Compares the current rMSSD against the rolling baseline to produce
 * a Go Hard / Moderate / Rest verdict. Supports two modes:
 *   - **Fixed**: static thresholds (default 95% / 80% of baseline median)
 *   - **Adaptive**: personal percentile-based cutoffs with Bayesian feedback
 *
 * The {@link computeVerdictWithMode} function unifies both paths and
 * returns a {@link VerdictResult} with the chosen verdict plus metadata.
 */
import { VerdictType, BaselineResult, Settings, Session, DEFAULT_SETTINGS } from '../types';
import { isInsufficientBaseline } from './baseline';
import { computeAdaptiveVerdict, AdaptiveResult } from './adaptiveThresholds';

/**
 * Result of verdict computation, wrapping both fixed and adaptive paths.
 */
export interface VerdictResult {
  verdict: VerdictType | null;
  /** True when adaptive mode is active but lacks sufficient history. */
  coldStart: boolean;
  /** Resolved cutoffs in absolute rMSSD (only populated in adaptive mode). */
  cutoffs?: { rest: number; hard: number };
  /** Number of history days used (only populated in adaptive mode). */
  historyN?: number;
}

/**
 * Determines the readiness verdict based on current rMSSD vs baseline.
 * @param currentRmssd Today's rMSSD value in milliseconds
 * @param baseline Rolling baseline result from {@link computeBaseline}
 * @param settings User settings with goHardThreshold and moderateThreshold
 * @returns Verdict type, or null if the baseline is insufficient (< 5 days or median = 0).
 * @example
 * const baseline = { median: 40, dayCount: 7, values: [38, 42, 45, 41, 43, 44, 40] };
 *
 * computeVerdict(42, baseline);  // → 'go_hard'  (42/40 = 1.05 ≥ 0.95)
 * computeVerdict(35, baseline);  // → 'moderate' (35/40 = 0.875 ≥ 0.80)
 * computeVerdict(28, baseline);  // → 'rest'     (28/40 = 0.70 < 0.80)
 *
 * // Insufficient baseline
 * computeVerdict(42, { median: 40, dayCount: 3, values: [] }); // → null
 */
export function computeVerdict(
  currentRmssd: number,
  baseline: BaselineResult,
  settings: Settings = DEFAULT_SETTINGS
): VerdictType | null {
  if (isInsufficientBaseline(baseline)) {
    return null;
  }

  const ratio = currentRmssd / baseline.median;

  if (ratio >= settings.goHardThreshold) {
    return 'go_hard';
  }

  if (ratio >= settings.moderateThreshold) {
    return 'moderate';
  }

  return 'rest';
}

/**
 * Unified verdict that respects the user's `verdictMode` setting.
 *
 * - `fixed` (default): uses ratio thresholds via {@link computeVerdict}.
 * - `adaptive`: uses personal percentile cutoffs via {@link computeAdaptiveVerdict},
 *   falling back to fixed thresholds during cold start (< 30 days).
 *
 * @param history Recent sessions (up to 60 days) needed for adaptive mode.
 *   Ignored when mode is `fixed`.
 * @returns VerdictResult with verdict, coldStart flag, and optional cutoffs.
 */
export function computeVerdictWithMode(
  currentRmssd: number,
  baseline: BaselineResult,
  settings: Settings = DEFAULT_SETTINGS,
  history: Session[] = []
): VerdictResult {
  if (settings.verdictMode === 'adaptive') {
    const result: AdaptiveResult = computeAdaptiveVerdict(currentRmssd, history, baseline, {
      goHardThreshold: settings.goHardThreshold,
      moderateThreshold: settings.moderateThreshold,
    });
    return {
      verdict: result.verdict,
      coldStart: result.coldStart,
      cutoffs: result.cutoffs,
      historyN: result.historyN,
    };
  }

  return {
    verdict: computeVerdict(currentRmssd, baseline, settings),
    coldStart: false,
  };
}
