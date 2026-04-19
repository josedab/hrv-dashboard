import {
  computeRmssdPercentile,
  computeSdnnPercentile,
  findNormEntry,
  NORM_TABLE,
} from '../../src/hrv/norms';

describe('NORM_TABLE', () => {
  it('has 10 entries (5 age groups × 2 sexes)', () => {
    expect(NORM_TABLE).toHaveLength(10);
  });

  it('covers ages 18 through 99 for both sexes', () => {
    for (const sex of ['male', 'female'] as const) {
      const entries = NORM_TABLE.filter((e) => e.sex === sex);
      expect(entries.length).toBe(5);
      expect(entries[0].ageGroup.minAge).toBe(18);
      expect(entries[entries.length - 1].ageGroup.maxAge).toBe(99);
    }
  });

  it('has monotonically increasing percentile values within each entry', () => {
    for (const entry of NORM_TABLE) {
      expect(entry.rmssd.p10).toBeLessThan(entry.rmssd.p25);
      expect(entry.rmssd.p25).toBeLessThan(entry.rmssd.p50);
      expect(entry.rmssd.p50).toBeLessThan(entry.rmssd.p75);
      expect(entry.rmssd.p75).toBeLessThan(entry.rmssd.p90);
    }
  });

  it('has generally decreasing rMSSD with age (within same sex)', () => {
    for (const sex of ['male', 'female'] as const) {
      const entries = NORM_TABLE.filter((e) => e.sex === sex);
      for (let i = 0; i < entries.length - 1; i++) {
        expect(entries[i].rmssd.p50).toBeGreaterThanOrEqual(entries[i + 1].rmssd.p50);
      }
    }
  });
});

describe('findNormEntry', () => {
  it('finds correct entry for 25-year-old male', () => {
    const entry = findNormEntry(25, 'male');
    expect(entry).not.toBeNull();
    expect(entry!.ageGroup.label).toBe('18–29');
    expect(entry!.sex).toBe('male');
  });

  it('finds correct entry for 45-year-old female', () => {
    const entry = findNormEntry(45, 'female');
    expect(entry).not.toBeNull();
    expect(entry!.ageGroup.label).toBe('40–49');
  });

  it('finds entry at age group boundary (30)', () => {
    const entry = findNormEntry(30, 'male');
    expect(entry!.ageGroup.label).toBe('30–39');
  });

  it('returns null for age < 18', () => {
    expect(findNormEntry(17, 'male')).toBeNull();
  });
});

describe('computeRmssdPercentile', () => {
  it('returns null for null age', () => {
    expect(computeRmssdPercentile(42, null, 'male')).toBeNull();
  });

  it('returns null for null sex', () => {
    expect(computeRmssdPercentile(42, 30, null)).toBeNull();
  });

  it('returns null for age under 18', () => {
    expect(computeRmssdPercentile(42, 15, 'male')).toBeNull();
  });

  it('returns ~50th percentile for median rMSSD value', () => {
    // 30-39 male median rMSSD is 36
    const result = computeRmssdPercentile(36, 35, 'male')!;
    expect(result).not.toBeNull();
    expect(result.percentile).toBeGreaterThanOrEqual(45);
    expect(result.percentile).toBeLessThanOrEqual(55);
    expect(result.label).toBe('Average');
    expect(result.ageGroup).toBe('30–39');
    expect(result.sex).toBe('male');
  });

  it('returns high percentile for high rMSSD', () => {
    // 30-39 male p90 is 78 → value of 80 should be >90th
    const result = computeRmssdPercentile(80, 35, 'male')!;
    expect(result.percentile).toBeGreaterThanOrEqual(90);
    expect(result.label).toBe('Excellent');
  });

  it('returns low percentile for low rMSSD', () => {
    // 30-39 male p10 is 15 → value of 10 should be <10th
    const result = computeRmssdPercentile(10, 35, 'male')!;
    expect(result.percentile).toBeLessThanOrEqual(10);
    expect(result.label).toBe('Low');
  });

  it('interpolates between known percentile points', () => {
    // 30-39 male: p25=23, p50=36. Value 30 → between 25th and 50th
    const result = computeRmssdPercentile(30, 35, 'male')!;
    expect(result.percentile).toBeGreaterThan(25);
    expect(result.percentile).toBeLessThan(50);
    expect(result.label).toBe('Below Average');
  });

  it('includes source citation', () => {
    const result = computeRmssdPercentile(42, 30, 'male')!;
    expect(result.source).toContain('Nunan');
    expect(result.source).toContain('Shaffer');
  });

  it('works for elderly female', () => {
    const result = computeRmssdPercentile(16, 70, 'female')!;
    expect(result).not.toBeNull();
    expect(result.ageGroup).toBe('60+');
    expect(result.percentile).toBeGreaterThanOrEqual(45);
    expect(result.percentile).toBeLessThanOrEqual(55);
  });

  it('caps percentile at 99', () => {
    const result = computeRmssdPercentile(200, 25, 'male')!;
    expect(result.percentile).toBeLessThanOrEqual(99);
  });

  it('floors percentile at 1', () => {
    const result = computeRmssdPercentile(1, 70, 'male')!;
    expect(result.percentile).toBeGreaterThanOrEqual(1);
  });
});

describe('computeSdnnPercentile', () => {
  it('returns null for missing demographics', () => {
    expect(computeSdnnPercentile(50, null, 'male')).toBeNull();
    expect(computeSdnnPercentile(50, 30, null)).toBeNull();
  });

  it('returns ~50th percentile for median SDNN value', () => {
    // 30-39 male median SDNN is 48
    const result = computeSdnnPercentile(48, 35, 'male')!;
    expect(result.percentile).toBeGreaterThanOrEqual(45);
    expect(result.percentile).toBeLessThanOrEqual(55);
  });

  it('returns different percentiles for same value at different ages', () => {
    const young = computeSdnnPercentile(40, 25, 'male')!;
    const old = computeSdnnPercentile(40, 55, 'male')!;
    // Same SDNN should rank higher in older group (lower norms)
    expect(old.percentile).toBeGreaterThan(young.percentile);
  });
});
