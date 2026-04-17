/**
 * Golden vectors used to verify cross-platform parity between the
 * TypeScript HRV engine and the native Swift / Kotlin ports. Native
 * implementations MUST produce metrics that match these to within
 * GOLDEN_TOLERANCE_MS for ms-valued metrics, and 0.001 for percentages.
 */
export interface GoldenVector {
  name: string;
  rrIntervals: number[];
  expected: {
    rmssd: number;
    sdnn: number;
    meanHr: number;
    pnn50: number;
  };
}

export const GOLDEN_VECTORS: GoldenVector[] = [
  {
    name: 'flat-perfect-1000ms',
    rrIntervals: Array(60).fill(1000),
    expected: { rmssd: 0, sdnn: 0, meanHr: 60, pnn50: 0 },
  },
  {
    name: 'simple-alternating-pair',
    rrIntervals: [800, 900, 800, 900, 800, 900, 800, 900, 800, 900],
    expected: { rmssd: 100, sdnn: 50, meanHr: 70.5882352941, pnn50: 100 },
  },
];

export const GOLDEN_TOLERANCE_MS = 0.001;
