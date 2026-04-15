import { VerdictType, BaselineResult, Settings, DEFAULT_SETTINGS } from '../types';
import { MIN_BASELINE_DAYS } from '../constants/defaults';

/**
 * Determines the readiness verdict based on current rMSSD vs baseline.
 * Returns null if insufficient baseline data (< MIN_BASELINE_DAYS days).
 */
export function computeVerdict(
  currentRmssd: number,
  baseline: BaselineResult,
  settings: Settings = DEFAULT_SETTINGS
): VerdictType | null {
  if (baseline.dayCount < MIN_BASELINE_DAYS) {
    return null;
  }

  if (baseline.median === 0) {
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
