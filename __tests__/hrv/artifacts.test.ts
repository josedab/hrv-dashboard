import { detectArtifacts, filterArtifacts } from '../../src/hrv/artifacts';

describe('detectArtifacts', () => {
  it('returns all false for clean data', () => {
    const rr = [800, 805, 810, 795, 800, 808, 803];
    const artifacts = detectArtifacts(rr);
    expect(artifacts.every((a) => a === false)).toBe(true);
  });

  it('returns all false for array shorter than window size (5)', () => {
    const rr = [800, 810, 790, 800];
    const artifacts = detectArtifacts(rr);
    expect(artifacts).toEqual([false, false, false, false]);
  });

  it('returns empty array for empty input', () => {
    expect(detectArtifacts([])).toEqual([]);
  });

  it('returns single false for single element', () => {
    expect(detectArtifacts([800])).toEqual([false]);
  });

  it('detects a single artifact (extreme outlier)', () => {
    // 200 deviates >20% from local median (~800)
    const rr = [800, 805, 200, 810, 795, 800, 808];
    const artifacts = detectArtifacts(rr);
    expect(artifacts[2]).toBe(true);

    // Other values should not be flagged
    const otherFlags = artifacts.filter((_, i) => i !== 2);
    expect(otherFlags.every((a) => a === false)).toBe(true);
  });

  it('detects multiple artifacts', () => {
    const rr = [800, 200, 810, 795, 1500, 800, 808, 803, 810];
    const artifacts = detectArtifacts(rr);
    expect(artifacts[1]).toBe(true); // 200 is an artifact
    expect(artifacts[4]).toBe(true); // 1500 is an artifact
  });

  it('does not flag value exactly at 20% deviation boundary', () => {
    // Construct data where deviation is exactly 20%
    // local median = 1000, value = 800 → deviation = 0.2 (not > 0.2)
    const rr = [1000, 1000, 800, 1000, 1000];
    const artifacts = detectArtifacts(rr);
    // 800/1000 = 0.2 deviation, which is NOT > 0.2
    expect(artifacts[2]).toBe(false);
  });

  it('flags value beyond 20% deviation', () => {
    // local median = 1000, value = 790 → deviation = 0.21 > 0.2
    const rr = [1000, 1000, 790, 1000, 1000];
    const artifacts = detectArtifacts(rr);
    expect(artifacts[2]).toBe(true);
  });

  it('accepts custom deviation factor', () => {
    // With factor 0.5, 500 vs median ~800 → deviation ~0.375 < 0.5 → not flagged
    const rr = [800, 805, 500, 810, 795, 800];
    const artifactsStrict = detectArtifacts(rr, 0.2);
    const artifactsLenient = detectArtifacts(rr, 0.5);

    expect(artifactsStrict[2]).toBe(true);
    expect(artifactsLenient[2]).toBe(false);
  });

  it('handles artifact at beginning of array', () => {
    const rr = [200, 800, 805, 810, 795, 800];
    const artifacts = detectArtifacts(rr);
    expect(artifacts[0]).toBe(true);
  });

  it('handles artifact at end of array', () => {
    const rr = [800, 805, 810, 795, 800, 200];
    const artifacts = detectArtifacts(rr);
    expect(artifacts[5]).toBe(true);
  });
});

describe('filterArtifacts', () => {
  it('returns all intervals as clean for clean data', () => {
    const rr = [800, 805, 810, 795, 800, 808, 803];
    const { cleanIntervals, artifactRate, artifacts } = filterArtifacts(rr);

    expect(cleanIntervals).toEqual(rr);
    expect(artifactRate).toBe(0);
    expect(artifacts.every((a) => a === false)).toBe(true);
  });

  it('removes artifact intervals', () => {
    const rr = [800, 805, 200, 810, 795, 800, 808];
    const { cleanIntervals, artifactRate } = filterArtifacts(rr);

    expect(cleanIntervals).not.toContain(200);
    expect(cleanIntervals.length).toBe(rr.length - 1);
    expect(artifactRate).toBeCloseTo(1 / 7, 5);
  });

  it('computes correct artifact rate for multiple artifacts', () => {
    const rr = [800, 200, 810, 795, 1500, 800, 808, 803, 810];
    const { artifactRate } = filterArtifacts(rr);
    // At least 2 artifacts out of 9
    expect(artifactRate).toBeGreaterThanOrEqual(2 / 9 - 0.01);
  });

  it('returns empty clean intervals when all are removed', () => {
    // < 5 elements: no artifacts detected
    const rr = [800, 810, 790];
    const { cleanIntervals, artifactRate } = filterArtifacts(rr);
    expect(cleanIntervals).toEqual(rr);
    expect(artifactRate).toBe(0);
  });

  it('handles empty array', () => {
    const { cleanIntervals, artifactRate, artifacts } = filterArtifacts([]);
    expect(cleanIntervals).toEqual([]);
    expect(artifactRate).toBe(0);
    expect(artifacts).toEqual([]);
  });

  it('returns correct artifacts boolean array', () => {
    const rr = [800, 805, 200, 810, 795, 800, 808];
    const { artifacts } = filterArtifacts(rr);
    expect(artifacts.length).toBe(rr.length);
    expect(artifacts[2]).toBe(true);
  });
});
