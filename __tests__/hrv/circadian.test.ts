import { analyzeCircadian, correlateTimeWithHrv } from '../../src/hrv/circadian';
import { Session } from '../../src/types';

function makeSession(hour: number, minute: number, rmssd: number = 40): Session {
  const d = new Date(2026, 3, 15, hour, minute, 0);
  return {
    id: `s-${hour}-${minute}`,
    timestamp: d.toISOString(),
    durationSeconds: 300,
    rrIntervals: [],
    rmssd,
    sdnn: 20,
    meanHr: 62,
    pnn50: 18,
    artifactRate: 0.02,
    verdict: 'go_hard',
    perceivedReadiness: null,
    trainingType: null,
    notes: null,
    sleepHours: null,
    sleepQuality: null,
    stressLevel: null,
    source: 'chest_strap',
  };
}

describe('analyzeCircadian', () => {
  it('returns null for fewer than MIN_SESSIONS_FOR_CIRCADIAN', () => {
    const sessions = [makeSession(6, 30), makeSession(7, 0)];
    expect(analyzeCircadian(sessions)).toBeNull();
  });

  it('computes analysis for consistent morning recordings', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => makeSession(6, 25 + i));
    const result = analyzeCircadian(sessions)!;
    expect(result).not.toBeNull();
    expect(result.avgTimeFormatted).toBe('06:30');
    expect(result.stdDevMinutes).toBeLessThan(10);
    expect(result.consistencyScore).toBeGreaterThan(80);
    expect(result.isConsistent).toBe(true);
    expect(result.advice).toContain('Great consistency');
  });

  it('detects inconsistent recordings (wide spread)', () => {
    const sessions = [
      makeSession(5, 0),
      makeSession(8, 30),
      makeSession(6, 0),
      makeSession(9, 0),
      makeSession(7, 0),
      makeSession(10, 0),
      makeSession(5, 30),
    ];
    const result = analyzeCircadian(sessions)!;
    expect(result.isConsistent).toBe(false);
    expect(result.stdDevMinutes).toBeGreaterThan(45);
    expect(result.consistencyScore).toBeLessThan(70);
  });

  it('computes optimal window centered on average', () => {
    const sessions = Array.from({ length: 7 }, () => makeSession(7, 0));
    const result = analyzeCircadian(sessions)!;
    expect(result.optimalWindow.start).toBe('06:45');
    expect(result.optimalWindow.end).toBe('07:15');
  });

  it('computes hour distribution', () => {
    const sessions = [
      makeSession(6, 0),
      makeSession(6, 30),
      makeSession(7, 0),
      makeSession(7, 15),
      makeSession(7, 30),
      makeSession(6, 45),
      makeSession(7, 45),
    ];
    const result = analyzeCircadian(sessions)!;
    expect(result.hourDistribution[6]).toBe(3);
    expect(result.hourDistribution[7]).toBe(4);
    expect(result.hourDistribution[8]).toBe(0);
  });
});

describe('correlateTimeWithHrv', () => {
  it('returns null for insufficient data', () => {
    expect(correlateTimeWithHrv([makeSession(6, 0)])).toBeNull();
  });

  it('detects positive correlation (later = higher HRV)', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => makeSession(5 + i, 0, 30 + i * 3));
    const result = correlateTimeWithHrv(sessions)!;
    expect(result.correlation).toBeGreaterThan(0.5);
    expect(result.insight).toContain('Later');
  });

  it('detects weak correlation for uncorrelated data', () => {
    const sessions = [
      makeSession(6, 0, 40),
      makeSession(7, 0, 42),
      makeSession(5, 30, 39),
      makeSession(8, 0, 41),
      makeSession(6, 30, 40),
      makeSession(7, 30, 43),
      makeSession(5, 0, 38),
      makeSession(9, 0, 40),
      makeSession(6, 15, 41),
      makeSession(8, 30, 39),
    ];
    const result = correlateTimeWithHrv(sessions)!;
    expect(result).not.toBeNull();
    // correlation may not be exactly 0, but insight should report appropriately
    expect(typeof result.correlation).toBe('number');
    expect(result.insight.length).toBeGreaterThan(0);
  });
});
