import { BaselineResult, DailyReading } from '../types';
import { MIN_BASELINE_DAYS } from '../constants/defaults';

/**
 * Returns true when a {@link BaselineResult} doesn't carry enough information
 * to compute a verdict or recovery score (too few days, or empty/zero median).
 * @returns True if baseline data is insufficient for verdict computation.
 */
export function isInsufficientBaseline(baseline: BaselineResult): boolean {
  return baseline.dayCount < MIN_BASELINE_DAYS || baseline.median <= 0;
}

/**
 * Computes the baseline rMSSD using the MEDIAN of daily readings
 * within the specified window. Median is more robust to outliers
 * than mean. Uses noon-based date arithmetic for DST safety.
 * @returns BaselineResult with median rMSSD, day count, and values array.
 */
export function computeBaseline(
  dailyReadings: DailyReading[],
  windowDays: number = 7
): BaselineResult {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - windowDays, 12);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

  const windowReadings = dailyReadings.filter((r) => r.date >= cutoffStr);
  const rmssdValues = windowReadings.map((r) => r.rmssd);

  return {
    median: computeMedian(rmssdValues),
    dayCount: rmssdValues.length,
    values: rmssdValues,
  };
}

/**
 * Computes the median of an array of numbers.
 * @returns Median value, or 0 for empty input.
 */
export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
