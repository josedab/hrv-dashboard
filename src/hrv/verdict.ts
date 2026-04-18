import { VerdictType, BaselineResult, Settings, DEFAULT_SETTINGS } from '../types';
import { isInsufficientBaseline } from './baseline';

/**
 * Determines the readiness verdict based on current rMSSD vs baseline.
 * Returns null if the baseline is insufficient (see {@link isInsufficientBaseline}).
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
