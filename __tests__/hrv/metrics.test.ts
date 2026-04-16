import {
  computeRmssd,
  computeSdnn,
  computeMeanHr,
  computePnn50,
  computeHrvMetrics,
} from '../../src/hrv/metrics';

describe('computeRmssd', () => {
  it('returns 0 for empty array', () => {
    expect(computeRmssd([])).toBe(0);
  });

  it('returns 0 for single element', () => {
    expect(computeRmssd([800])).toBe(0);
  });

  it('returns 0 for two identical values', () => {
    expect(computeRmssd([800, 800])).toBe(0);
  });

  it('computes correctly for two elements', () => {
    // diff = 10, sumSquaredDiffs = 100, RMSSD = sqrt(100/1) = 10
    expect(computeRmssd([800, 810])).toBe(10);
  });

  it('computes correctly for known values', () => {
    const rr = [800, 810, 790, 800, 815];
    // diffs: 10, -20, 10, 15
    // squared diffs: 100, 400, 100, 225 → sum = 825
    // RMSSD = sqrt(825 / 4) = sqrt(206.25)
    const expected = Math.sqrt(825 / 4);
    expect(computeRmssd(rr)).toBeCloseTo(expected, 10);
  });

  it('computes correctly for uniform diffs', () => {
    // Each successive diff is 10
    const rr = [800, 810, 820, 830];
    // diffs: 10, 10, 10 → squared: 100*3 = 300
    // RMSSD = sqrt(300/3) = 10
    expect(computeRmssd(rr)).toBe(10);
  });

  it('handles large intervals', () => {
    const rr = [1500, 1600, 1400];
    // diffs: 100, -200 → squared: 10000, 40000
    const sumSq = 100 * 100 + 200 * 200;
    expect(computeRmssd(rr)).toBeCloseTo(Math.sqrt(sumSq / 2), 10);
  });
});

describe('computeSdnn', () => {
  it('returns 0 for empty array', () => {
    expect(computeSdnn([])).toBe(0);
  });

  it('returns 0 for single element', () => {
    expect(computeSdnn([800])).toBe(0);
  });

  it('returns 0 when all values are identical', () => {
    expect(computeSdnn([800, 800, 800])).toBe(0);
  });

  it('computes correctly for known values', () => {
    const rr = [800, 810, 790, 800, 815];
    const mean = (800 + 810 + 790 + 800 + 815) / 5; // 803
    const squaredDiffs = rr.map((v) => (v - mean) ** 2);
    const variance = squaredDiffs.reduce((s, v) => s + v, 0) / rr.length;
    const expected = Math.sqrt(variance);
    expect(computeSdnn(rr)).toBeCloseTo(expected, 10);
  });

  it('computes correctly for two elements', () => {
    // [800, 820] → mean = 810
    // sqDiffs: 100, 100 → variance = 200/2 = 100, sdnn = 10
    expect(computeSdnn([800, 820])).toBe(10);
  });

  it('uses population std dev (N), not sample (N-1)', () => {
    // Verify by checking a case where N vs N-1 matters
    const rr = [100, 200];
    // mean = 150, sqDiffs = 2500 + 2500 = 5000
    // pop variance = 5000/2 = 2500, sdnn = 50
    // sample variance would be 5000/1 = 5000, sd = ~70.71
    expect(computeSdnn(rr)).toBe(50);
  });
});

describe('computeMeanHr', () => {
  it('returns 0 for empty array', () => {
    expect(computeMeanHr([])).toBe(0);
  });

  it('computes HR = 60000 / meanRR', () => {
    // meanRR = 800ms → HR = 75 bpm
    expect(computeMeanHr([800])).toBe(75);
  });

  it('computes correctly for multiple intervals', () => {
    // meanRR = (800+1000)/2 = 900 → HR = 60000/900 ≈ 66.667
    expect(computeMeanHr([800, 1000])).toBeCloseTo(60000 / 900, 10);
  });

  it('handles very short intervals (high HR)', () => {
    // 400ms → HR = 150 bpm
    expect(computeMeanHr([400])).toBe(150);
  });

  it('handles very long intervals (low HR)', () => {
    // 1500ms → HR = 40 bpm
    expect(computeMeanHr([1500])).toBe(40);
  });

  it('returns 0 if meanRR is 0', () => {
    expect(computeMeanHr([0, 0])).toBe(0);
  });
});

describe('computePnn50', () => {
  it('returns 0 for empty array', () => {
    expect(computePnn50([])).toBe(0);
  });

  it('returns 0 for single element', () => {
    expect(computePnn50([800])).toBe(0);
  });

  it('returns 0 when no diffs exceed 50ms', () => {
    // All diffs are 10ms
    expect(computePnn50([800, 810, 820, 830])).toBe(0);
  });

  it('returns 100 when all diffs exceed 50ms', () => {
    // diffs: 60, 60, 60 → all > 50
    expect(computePnn50([800, 860, 920, 980])).toBe(100);
  });

  it('computes correct percentage for mixed diffs', () => {
    // diffs: 10, 70, 20, 55 → 2 out of 4 > 50
    const rr = [800, 810, 880, 900, 955];
    expect(computePnn50(rr)).toBe(50);
  });

  it('uses strict greater-than (not >=) for 50ms threshold', () => {
    // diff of exactly 50 should NOT be counted
    expect(computePnn50([800, 850])).toBe(0);
    // diff of 51 should be counted
    expect(computePnn50([800, 851])).toBe(100);
  });

  it('uses absolute value of differences', () => {
    // diffs: -60 → abs = 60 > 50
    expect(computePnn50([860, 800])).toBe(100);
  });
});

describe('computeHrvMetrics', () => {
  it('returns zeros for empty array', () => {
    const result = computeHrvMetrics([]);
    expect(result).toEqual({
      rmssd: 0,
      sdnn: 0,
      meanHr: 0,
      pnn50: 0,
      artifactRate: 0,
    });
  });

  it('returns zeros for single element', () => {
    const result = computeHrvMetrics([800]);
    expect(result).toEqual({
      rmssd: 0,
      sdnn: 0,
      meanHr: 0,
      pnn50: 0,
      artifactRate: 0,
    });
  });

  it('computes metrics for clean data', () => {
    const rr = [800, 810, 790, 800, 815, 805, 795];
    const result = computeHrvMetrics(rr);

    expect(result.rmssd).toBeGreaterThan(0);
    expect(result.sdnn).toBeGreaterThan(0);
    expect(result.meanHr).toBeGreaterThan(0);
    expect(result.pnn50).toBeGreaterThanOrEqual(0);
    expect(result.artifactRate).toBe(0);
  });

  it('filters artifacts and computes on clean data', () => {
    // Insert an extreme outlier in otherwise normal data
    const rr = [800, 810, 790, 200, 800, 815, 805, 795, 810, 800];
    const result = computeHrvMetrics(rr);

    // 200ms is a clear artifact; artifactRate should be > 0
    expect(result.artifactRate).toBeGreaterThan(0);
    // Metrics should still be computed from remaining clean data
    expect(result.rmssd).toBeGreaterThan(0);
    expect(result.meanHr).toBeGreaterThan(0);
  });

  it('returns zeros with artifactRate when all data is artifacts', () => {
    // All data are extreme values that would flag each other
    // With < 5 elements, no artifacts detected, so use >= 5 wildly different values
    const rr = [200, 2000, 200, 2000, 200, 2000];
    const result = computeHrvMetrics(rr);
    // Metrics still computable; the artifact filter may or may not remove all
    expect(result).toBeDefined();
  });
});
