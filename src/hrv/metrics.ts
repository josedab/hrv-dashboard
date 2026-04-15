import { HrvMetrics } from '../types';
import { filterArtifacts } from './artifacts';

/**
 * Computes all HRV metrics from raw RR intervals.
 * Automatically detects and filters artifacts before computation.
 */
export function computeHrvMetrics(rawRrIntervals: number[]): HrvMetrics {
  if (rawRrIntervals.length < 2) {
    return {
      rmssd: 0,
      sdnn: 0,
      meanHr: 0,
      pnn50: 0,
      artifactRate: 0,
    };
  }

  const { cleanIntervals, artifactRate } = filterArtifacts(rawRrIntervals);

  if (cleanIntervals.length < 2) {
    return {
      rmssd: 0,
      sdnn: 0,
      meanHr: 0,
      pnn50: 0,
      artifactRate,
    };
  }

  return {
    rmssd: computeRmssd(cleanIntervals),
    sdnn: computeSdnn(cleanIntervals),
    meanHr: computeMeanHr(cleanIntervals),
    pnn50: computePnn50(cleanIntervals),
    artifactRate,
  };
}

/**
 * Root Mean Square of Successive Differences.
 * Primary HRV metric for readiness assessment.
 */
export function computeRmssd(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;

  let sumSquaredDiffs = 0;
  for (let i = 1; i < rrIntervals.length; i++) {
    const diff = rrIntervals[i] - rrIntervals[i - 1];
    sumSquaredDiffs += diff * diff;
  }

  return Math.sqrt(sumSquaredDiffs / (rrIntervals.length - 1));
}

/**
 * Standard Deviation of NN intervals.
 * Measures overall HRV variability.
 */
export function computeSdnn(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;

  const mean = rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
  const squaredDiffs = rrIntervals.map((val) => (val - mean) ** 2);
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / rrIntervals.length;

  return Math.sqrt(variance);
}

/**
 * Computes mean heart rate from RR intervals (in ms).
 * HR (bpm) = 60000 / mean_RR_ms
 */
export function computeMeanHr(rrIntervals: number[]): number {
  if (rrIntervals.length === 0) return 0;

  const meanRr = rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
  if (meanRr === 0) return 0;

  return 60000 / meanRr;
}

/**
 * Percentage of successive RR intervals that differ by more than 50ms.
 */
export function computePnn50(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;

  let count = 0;
  for (let i = 1; i < rrIntervals.length; i++) {
    if (Math.abs(rrIntervals[i] - rrIntervals[i - 1]) > 50) {
      count++;
    }
  }

  return (count / (rrIntervals.length - 1)) * 100;
}
