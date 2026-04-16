import { ARTIFACT_DEVIATION_FACTOR } from '../constants/defaults';

/**
 * Detects artifacts in RR interval data using a local moving median approach.
 * An RR interval is flagged as artifact if it deviates more than 20% from
 * the local median of surrounding 5 beats.
 *
 * Returns a boolean array where true = artifact.
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
    const localMedian = median(window);

    if (localMedian === 0) continue;

    const deviation = Math.abs(rrIntervals[i] - localMedian) / localMedian;
    artifacts[i] = deviation > deviationFactor;
  }

  return artifacts;
}

/**
 * Filters out artifact RR intervals and returns only clean intervals.
 */
export function filterArtifacts(rrIntervals: number[]): {
  cleanIntervals: number[];
  artifactRate: number;
  artifacts: boolean[];
} {
  const artifacts = detectArtifacts(rrIntervals);
  const artifactCount = artifacts.filter(Boolean).length;
  const artifactRate = rrIntervals.length > 0 ? artifactCount / rrIntervals.length : 0;

  const cleanIntervals = rrIntervals.filter((_, i) => !artifacts[i]);

  return { cleanIntervals, artifactRate, artifacts };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
