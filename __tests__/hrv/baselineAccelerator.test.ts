import { accelerateBaseline } from '../../src/hrv/baselineAccelerator';
import { Session } from '../../src/types';

function makeSession(
  daysAgo: number,
  rmssd: number,
  source: 'chest_strap' | 'camera' = 'chest_strap'
): Session {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    id: `s-${daysAgo}`,
    timestamp: d.toISOString(),
    durationSeconds: 300,
    rrIntervals: [],
    rmssd,
    sdnn: rmssd * 0.5,
    meanHr: 62,
    pnn50: 18,
    artifactRate: 0.02,
    verdict: null,
    perceivedReadiness: null,
    trainingType: null,
    notes: null,
    sleepHours: null,
    sleepQuality: null,
    stressLevel: null,
    source,
  };
}

describe('accelerateBaseline', () => {
  it('returns not ready for empty sessions', () => {
    const result = accelerateBaseline([]);
    expect(result.ready).toBe(false);
    expect(result.sessionsUsed).toBe(0);
    expect(result.message).toContain('No sessions');
  });

  it('computes baseline from sufficient imported data (≥5 days)', () => {
    const sessions = Array.from({ length: 7 }, (_, i) => makeSession(i + 1, 35 + i * 2));
    const result = accelerateBaseline(sessions);
    expect(result.ready).toBe(true);
    expect(result.daysUsed).toBe(7);
    expect(result.baseline.median).toBeGreaterThan(0);
    expect(result.message).toContain('Baseline computed');
    expect(result.message).toContain('7 imported days');
  });

  it('returns not ready for insufficient data (<5 days)', () => {
    const sessions = Array.from({ length: 3 }, (_, i) => makeSession(i + 1, 40));
    const result = accelerateBaseline(sessions);
    expect(result.ready).toBe(false);
    expect(result.message).toContain('more day');
  });

  it('excludes camera sessions from baseline', () => {
    const sessions = [
      makeSession(1, 40, 'camera'),
      makeSession(2, 42, 'camera'),
      makeSession(3, 38, 'camera'),
      makeSession(4, 41, 'camera'),
      makeSession(5, 39, 'camera'),
    ];
    const result = accelerateBaseline(sessions);
    expect(result.ready).toBe(false);
    expect(result.sessionsUsed).toBe(0);
    expect(result.message).toContain('Camera-based');
  });

  it('deduplicates same-day sessions (uses first)', () => {
    const sessions = [
      makeSession(1, 42),
      { ...makeSession(1, 38), id: 'duplicate' },
      ...Array.from({ length: 5 }, (_, i) => makeSession(i + 2, 40)),
    ];
    const result = accelerateBaseline(sessions);
    expect(result.daysUsed).toBe(6);
  });

  it('uses only the most recent baselineWindowDays', () => {
    const sessions = Array.from({ length: 20 }, (_, i) => makeSession(i + 1, 40));
    const result = accelerateBaseline(sessions, 7);
    expect(result.daysUsed).toBeLessThanOrEqual(7);
  });

  it('reports correct sessionsUsed count', () => {
    const sessions = [makeSession(1, 40), makeSession(2, 42), makeSession(3, 38, 'camera')];
    const result = accelerateBaseline(sessions);
    expect(result.sessionsUsed).toBe(2); // only chest_strap
  });
});
