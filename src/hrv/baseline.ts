import { BaselineResult, DailyReading } from '../types';

/**
 * Computes the baseline rMSSD using the MEDIAN of daily readings
 * within the specified window. Median is more robust to outliers
 * than mean.
 */
export function computeBaseline(
  dailyReadings: DailyReading[],
  windowDays: number = 7
): BaselineResult {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - windowDays);

  const windowReadings = dailyReadings.filter((r) => {
    const readingDate = new Date(r.date);
    return readingDate >= cutoff && readingDate <= now;
  });

  const rmssdValues = windowReadings.map((r) => r.rmssd);

  return {
    median: computeMedian(rmssdValues),
    dayCount: rmssdValues.length,
    values: rmssdValues,
  };
}

/**
 * Computes the median of an array of numbers.
 */
export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
