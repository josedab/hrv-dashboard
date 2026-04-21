/** Artifact detection using a 5-beat moving median filter (flags RR intervals deviating >20%). */
import { ARTIFACT_DEVIATION_FACTOR } from '../constants/defaults';
import { computeMedian } from './baseline';

/**
 * Detects artifacts in RR interval data using a local moving median approach.
 * An RR interval is flagged as artifact if it deviates more than 20% from
 * the local median of surrounding 5 beats.
 *
 * @returns Boolean array where true = artifact. Same length as input.
 */
export function detectArtifacts(
  rrIntervals: number[],
  deviationFactor: number = ARTIFACT_DEVIATION_FACTOR
): boolean[] {
  const windowSize = 5;
  const halfWindow = Math.floor(windowSize / 2);
  const artifacts: boolean[] = new Array(rrIntervals.length).fill(false);

  if (rrIntervals.length < windowSize) {
    return artifacts;
  }

  for (let i = 0; i < rrIntervals.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(rrIntervals.length, i + halfWindow + 1);
    const window = rrIntervals.slice(start, end);
    const localMedian = computeMedian(window);

    if (localMedian === 0) continue;

    const deviation = Math.abs(rrIntervals[i] - localMedian) / localMedian;
    artifacts[i] = deviation > deviationFactor;
  }

  return artifacts;
}

/**
 * Filters out artifact RR intervals and returns only clean intervals.
 * @param toleranceFactor Per-device multiplier on the deviation threshold (default 1.0).
 *   Higher values = more lenient filtering, suitable for optical sensors.
 * @returns Object with cleanIntervals, artifactRate (0–1), and artifacts boolean array.
 */
export function filterArtifacts(
  rrIntervals: number[],
  toleranceFactor: number = 1.0
): {
  cleanIntervals: number[];
  artifactRate: number;
  artifacts: boolean[];
} {
  const effectiveDeviation = ARTIFACT_DEVIATION_FACTOR * toleranceFactor;
  const artifacts = detectArtifacts(rrIntervals, effectiveDeviation);
  const artifactCount = artifacts.filter(Boolean).length;
  const artifactRate = rrIntervals.length > 0 ? artifactCount / rrIntervals.length : 0;

  const cleanIntervals = rrIntervals.filter((_, i) => !artifacts[i]);

  return { cleanIntervals, artifactRate, artifacts };
}
