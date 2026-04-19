jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { summarizeSleep, _resetHealthModuleCache } from '../../src/integrations/healthSleep';

beforeEach(() => {
  _resetHealthModuleCache();
});

describe('summarizeSleep', () => {
  it('returns null for empty samples', () => {
    expect(summarizeSleep([])).toBeNull();
  });

  it('returns null when all samples are INBED or AWAKE', () => {
    const samples = [
      { value: 'INBED', startDate: '2026-04-15T22:00:00Z', endDate: '2026-04-16T06:00:00Z' },
      { value: 'AWAKE', startDate: '2026-04-16T03:00:00Z', endDate: '2026-04-16T03:15:00Z' },
    ];
    expect(summarizeSleep(samples)).toBeNull();
  });

  it('computes total sleep hours from DEEP+REM+CORE stages', () => {
    const samples = [
      { value: 'DEEP', startDate: '2026-04-15T23:00:00Z', endDate: '2026-04-16T01:00:00Z' },
      { value: 'REM', startDate: '2026-04-16T01:00:00Z', endDate: '2026-04-16T02:30:00Z' },
      { value: 'CORE', startDate: '2026-04-16T02:30:00Z', endDate: '2026-04-16T05:30:00Z' },
    ];
    const result = summarizeSleep(samples)!;
    expect(result).not.toBeNull();
    // 2h + 1.5h + 3h = 6.5h
    expect(result.hoursTotal).toBeCloseTo(6.5, 1);
  });

  it('excludes INBED and AWAKE from total sleep time', () => {
    const samples = [
      { value: 'INBED', startDate: '2026-04-15T22:00:00Z', endDate: '2026-04-15T23:00:00Z' },
      { value: 'DEEP', startDate: '2026-04-15T23:00:00Z', endDate: '2026-04-16T01:00:00Z' },
      { value: 'AWAKE', startDate: '2026-04-16T01:00:00Z', endDate: '2026-04-16T01:15:00Z' },
      { value: 'CORE', startDate: '2026-04-16T01:15:00Z', endDate: '2026-04-16T05:00:00Z' },
    ];
    const result = summarizeSleep(samples)!;
    // Only DEEP(2h) + CORE(3.75h) = 5.75h, INBED and AWAKE excluded
    expect(result.hoursTotal).toBeCloseTo(5.75, 1);
  });

  it('computes quality estimate from restorative share (DEEP + REM)', () => {
    // 50% restorative → 0.5 × 10 = 5
    const samples = [
      { value: 'DEEP', startDate: '2026-04-15T23:00:00Z', endDate: '2026-04-16T01:00:00Z' },
      { value: 'REM', startDate: '2026-04-16T01:00:00Z', endDate: '2026-04-16T02:00:00Z' },
      { value: 'CORE', startDate: '2026-04-16T02:00:00Z', endDate: '2026-04-16T05:00:00Z' },
    ];
    const result = summarizeSleep(samples)!;
    // DEEP(2h) + REM(1h) = 3h out of total 6h = 50%
    expect(result.qualityEstimate).toBe(5);
  });

  it('caps quality estimate at 5', () => {
    // 100% DEEP → 1.0 × 10 = 10, capped at 5
    const samples = [
      { value: 'DEEP', startDate: '2026-04-15T23:00:00Z', endDate: '2026-04-16T06:00:00Z' },
    ];
    const result = summarizeSleep(samples)!;
    expect(result.qualityEstimate).toBe(5);
  });

  it('floors quality estimate at 1 when restorative share is small', () => {
    // 5% restorative → 0.05 × 10 = 0.5 → rounds to 1 (min)
    const samples = [
      { value: 'DEEP', startDate: '2026-04-16T05:00:00Z', endDate: '2026-04-16T05:18:00Z' },
      { value: 'CORE', startDate: '2026-04-15T23:00:00Z', endDate: '2026-04-16T05:00:00Z' },
    ];
    const result = summarizeSleep(samples)!;
    expect(result.qualityEstimate).toBeGreaterThanOrEqual(1);
    expect(result.qualityEstimate).toBeLessThanOrEqual(5);
  });

  it('returns null quality estimate when no DEEP or REM stages', () => {
    const samples = [
      { value: 'CORE', startDate: '2026-04-15T23:00:00Z', endDate: '2026-04-16T06:00:00Z' },
    ];
    const result = summarizeSleep(samples)!;
    expect(result.qualityEstimate).toBeNull();
  });

  it('sets startedAt and endedAt from earliest and latest sample boundaries', () => {
    const samples = [
      { value: 'CORE', startDate: '2026-04-16T01:00:00Z', endDate: '2026-04-16T03:00:00Z' },
      { value: 'DEEP', startDate: '2026-04-15T23:00:00Z', endDate: '2026-04-16T01:00:00Z' },
      { value: 'REM', startDate: '2026-04-16T03:00:00Z', endDate: '2026-04-16T05:00:00Z' },
    ];
    const result = summarizeSleep(samples)!;
    expect(result.startedAt).toBe('2026-04-15T23:00:00.000Z');
    expect(result.endedAt).toBe('2026-04-16T05:00:00.000Z');
  });

  it('skips samples with invalid dates (NaN)', () => {
    const samples = [
      { value: 'DEEP', startDate: 'not-a-date', endDate: 'also-not' },
      { value: 'CORE', startDate: '2026-04-15T23:00:00Z', endDate: '2026-04-16T06:00:00Z' },
    ];
    const result = summarizeSleep(samples)!;
    expect(result).not.toBeNull();
    expect(result.hoursTotal).toBeCloseTo(7.0, 1);
  });

  it('skips samples where end <= start', () => {
    const samples = [
      { value: 'DEEP', startDate: '2026-04-16T06:00:00Z', endDate: '2026-04-15T23:00:00Z' },
      { value: 'CORE', startDate: '2026-04-15T23:00:00Z', endDate: '2026-04-16T06:00:00Z' },
    ];
    const result = summarizeSleep(samples)!;
    expect(result.hoursTotal).toBeCloseTo(7.0, 1);
  });

  it('returns null when all valid samples have totalMs of 0', () => {
    // All samples have invalid dates → totalMs stays 0
    const samples = [{ value: 'DEEP', startDate: 'bad', endDate: 'bad2' }];
    expect(summarizeSleep(samples)).toBeNull();
  });

  it('handles single DEEP sample correctly', () => {
    const samples = [
      { value: 'DEEP', startDate: '2026-04-16T01:00:00Z', endDate: '2026-04-16T03:00:00Z' },
    ];
    const result = summarizeSleep(samples)!;
    expect(result.hoursTotal).toBe(2);
    expect(result.qualityEstimate).toBe(5);
  });

  it('rounds hours to one decimal place', () => {
    // 7h 20m = 7.333... → rounds to 7.3
    const samples = [
      { value: 'CORE', startDate: '2026-04-15T22:40:00Z', endDate: '2026-04-16T06:00:00Z' },
    ];
    const result = summarizeSleep(samples)!;
    expect(result.hoursTotal).toBe(7.3);
  });
});
