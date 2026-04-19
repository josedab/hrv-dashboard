import { buildHypnogram, normalizeStage, correlateSleepHrv } from '../../src/hrv/sleepArchitecture';

describe('normalizeStage', () => {
  it('maps DEEP to deep', () => expect(normalizeStage('DEEP')).toBe('deep'));
  it('maps REM to rem', () => expect(normalizeStage('REM')).toBe('rem'));
  it('maps CORE/LIGHT to light', () => {
    expect(normalizeStage('CORE')).toBe('light');
    expect(normalizeStage('LIGHT')).toBe('light');
  });
  it('maps AWAKE/INBED to awake', () => {
    expect(normalizeStage('AWAKE')).toBe('awake');
    expect(normalizeStage('INBED')).toBe('awake');
  });
  it('defaults unknown to light', () => expect(normalizeStage('UNKNOWN')).toBe('light'));
});

describe('buildHypnogram', () => {
  it('returns null for empty samples', () => {
    expect(buildHypnogram([])).toBeNull();
  });

  it('returns null for samples with invalid dates', () => {
    expect(buildHypnogram([{ value: 'DEEP', startDate: 'bad', endDate: 'bad' }])).toBeNull();
  });

  it('builds hypnogram from valid samples', () => {
    const samples = [
      { value: 'DEEP', startDate: '2026-04-15T23:00:00Z', endDate: '2026-04-16T01:00:00Z' },
      { value: 'REM', startDate: '2026-04-16T01:00:00Z', endDate: '2026-04-16T02:00:00Z' },
      { value: 'LIGHT', startDate: '2026-04-16T02:00:00Z', endDate: '2026-04-16T05:00:00Z' },
      { value: 'AWAKE', startDate: '2026-04-16T03:00:00Z', endDate: '2026-04-16T03:15:00Z' },
    ];
    const result = buildHypnogram(samples)!;
    expect(result).not.toBeNull();
    expect(result.segments).toHaveLength(4);
    expect(result.stageMinutes.deep).toBe(120);
    expect(result.stageMinutes.rem).toBe(60);
    expect(result.stageMinutes.light).toBe(180);
    expect(result.stageMinutes.awake).toBe(15);
  });

  it('computes restorative percentage (deep + REM)', () => {
    const samples = [
      { value: 'DEEP', startDate: '2026-04-15T23:00:00Z', endDate: '2026-04-16T01:00:00Z' },
      { value: 'REM', startDate: '2026-04-16T01:00:00Z', endDate: '2026-04-16T02:00:00Z' },
      { value: 'CORE', startDate: '2026-04-16T02:00:00Z', endDate: '2026-04-16T05:00:00Z' },
    ];
    const result = buildHypnogram(samples)!;
    // deep(120) + rem(60) = 180 out of 360 total = 50%
    expect(result.restorativePercent).toBe(50);
  });

  it('counts wake episodes', () => {
    const samples = [
      { value: 'DEEP', startDate: '2026-04-15T23:00:00Z', endDate: '2026-04-16T01:00:00Z' },
      { value: 'AWAKE', startDate: '2026-04-16T01:00:00Z', endDate: '2026-04-16T01:10:00Z' },
      { value: 'LIGHT', startDate: '2026-04-16T01:10:00Z', endDate: '2026-04-16T03:00:00Z' },
      { value: 'AWAKE', startDate: '2026-04-16T03:00:00Z', endDate: '2026-04-16T03:05:00Z' },
      { value: 'REM', startDate: '2026-04-16T03:05:00Z', endDate: '2026-04-16T05:00:00Z' },
    ];
    const result = buildHypnogram(samples)!;
    expect(result.wakeEpisodes).toBe(2);
  });

  it('sorts samples chronologically', () => {
    const samples = [
      { value: 'REM', startDate: '2026-04-16T02:00:00Z', endDate: '2026-04-16T03:00:00Z' },
      { value: 'DEEP', startDate: '2026-04-15T23:00:00Z', endDate: '2026-04-16T02:00:00Z' },
    ];
    const result = buildHypnogram(samples)!;
    expect(result.segments[0].stage).toBe('deep');
    expect(result.segments[1].stage).toBe('rem');
    expect(result.segments[0].startMinute).toBe(0);
  });
});

describe('correlateSleepHrv', () => {
  const goodSleep = buildHypnogram([
    { value: 'DEEP', startDate: '2026-04-15T23:00:00Z', endDate: '2026-04-16T01:30:00Z' },
    { value: 'REM', startDate: '2026-04-16T01:30:00Z', endDate: '2026-04-16T03:00:00Z' },
    { value: 'LIGHT', startDate: '2026-04-16T03:00:00Z', endDate: '2026-04-16T06:00:00Z' },
  ])!;

  const poorSleep = buildHypnogram([
    { value: 'LIGHT', startDate: '2026-04-15T23:00:00Z', endDate: '2026-04-16T05:00:00Z' },
    { value: 'DEEP', startDate: '2026-04-16T05:00:00Z', endDate: '2026-04-16T05:30:00Z' },
  ])!;

  it('gives positive insight for good sleep + high HRV', () => {
    const result = correlateSleepHrv(goodSleep, 45, 40);
    expect(result.insight).toContain('Excellent');
  });

  it('gives negative insight for poor sleep + low HRV', () => {
    const result = correlateSleepHrv(poorSleep, 30, 40);
    expect(result.insight).toContain('Low restorative');
  });

  it('provides default insight for normal ranges', () => {
    // goodSleep has ~43% restorative (≥35%), rMSSD = 37/40 = 92.5% (between 85-95%)
    // This triggers the "decent sleep but low HRV" branch at first glance but
    // 92.5 is not < 85, so it falls through to the default "normal ranges" case.
    const normalSleep = buildHypnogram([
      { value: 'DEEP', startDate: '2026-04-15T23:00:00Z', endDate: '2026-04-16T00:30:00Z' },
      { value: 'REM', startDate: '2026-04-16T00:30:00Z', endDate: '2026-04-16T01:30:00Z' },
      { value: 'LIGHT', startDate: '2026-04-16T01:30:00Z', endDate: '2026-04-16T06:00:00Z' },
    ])!;
    // 90+60 = 150 restorative out of 420 total = 35.7% → ≥35%, and rMSSD 38/40 = 95% → ≥ 95
    // We need restorative 25-40% and rMSSD 85-95% to hit default
    // Use 37/40 = 92.5% to avoid the "excellent" branch, and normalSleep restorative ~ 36%
    const result = correlateSleepHrv(normalSleep, 37, 40);
    expect(result.insight).toContain('normal');
  });
});
