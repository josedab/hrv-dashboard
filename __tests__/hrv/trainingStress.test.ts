import {
  aggregateDailyLoads,
  computeTsbSeries,
  computeTsbFromSessions,
  getLatestTsb,
  classifyTsb,
  DailyLoad,
} from '../../src/hrv/trainingStress';
import { Session } from '../../src/types';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test',
    timestamp: '2026-04-15T06:30:00Z',
    durationSeconds: 300,
    rrIntervals: [],
    rmssd: 40,
    sdnn: 20,
    meanHr: 60,
    pnn50: 15,
    artifactRate: 0.02,
    verdict: 'go_hard',
    perceivedReadiness: 4,
    trainingType: 'Strength',
    notes: null,
    sleepHours: null,
    sleepQuality: null,
    stressLevel: null,
    source: 'chest_strap',
    ...overrides,
  };
}

describe('classifyTsb', () => {
  it('classifies positive TSB > 15 as fresh', () => {
    expect(classifyTsb(20)).toBe('fresh');
    expect(classifyTsb(16)).toBe('fresh');
  });

  it('classifies TSB -10 to 15 as optimal', () => {
    expect(classifyTsb(15)).toBe('optimal');
    expect(classifyTsb(0)).toBe('optimal');
    expect(classifyTsb(-10)).toBe('optimal');
  });

  it('classifies TSB -30 to -11 as fatigued', () => {
    expect(classifyTsb(-11)).toBe('fatigued');
    expect(classifyTsb(-30)).toBe('fatigued');
  });

  it('classifies TSB < -30 as overreaching', () => {
    expect(classifyTsb(-31)).toBe('overreaching');
    expect(classifyTsb(-50)).toBe('overreaching');
  });
});

describe('aggregateDailyLoads', () => {
  it('returns empty for no sessions', () => {
    expect(aggregateDailyLoads([])).toEqual([]);
  });

  it('aggregates sessions on the same day', () => {
    const sessions = [
      makeSession({ id: 'a', timestamp: '2026-04-15T06:30:00Z', trainingType: 'Strength' }),
      makeSession({ id: 'b', timestamp: '2026-04-15T18:00:00Z', trainingType: 'Cycling' }),
    ];
    const loads = aggregateDailyLoads(sessions);
    expect(loads).toHaveLength(1);
    expect(loads[0].date).toBe('2026-04-15');
    expect(loads[0].load).toBeGreaterThan(0);
  });

  it('sorts by date ascending', () => {
    const sessions = [
      makeSession({ timestamp: '2026-04-16T06:30:00Z' }),
      makeSession({ timestamp: '2026-04-14T06:30:00Z' }),
      makeSession({ timestamp: '2026-04-15T06:30:00Z' }),
    ];
    const loads = aggregateDailyLoads(sessions);
    expect(loads.map((l) => l.date)).toEqual(['2026-04-14', '2026-04-15', '2026-04-16']);
  });

  it('returns zero load for sessions with no training type', () => {
    const sessions = [makeSession({ trainingType: null })];
    const loads = aggregateDailyLoads(sessions);
    expect(loads[0].load).toBe(0);
  });
});

describe('computeTsbSeries', () => {
  it('returns empty for no loads', () => {
    expect(computeTsbSeries([])).toEqual([]);
  });

  it('returns one point for a single load', () => {
    const loads: DailyLoad[] = [{ date: '2026-04-15', load: 100 }];
    const series = computeTsbSeries(loads);
    expect(series).toHaveLength(1);
    expect(series[0].date).toBe('2026-04-15');
    expect(series[0].dailyLoad).toBe(100);
    expect(series[0].atl).toBeGreaterThan(0);
    expect(series[0].ctl).toBeGreaterThan(0);
  });

  it('fills in zero-load days between sessions', () => {
    const loads: DailyLoad[] = [
      { date: '2026-04-10', load: 100 },
      { date: '2026-04-15', load: 80 },
    ];
    const series = computeTsbSeries(loads);
    // Should have 6 days: 10, 11, 12, 13, 14, 15
    expect(series).toHaveLength(6);
    expect(series[1].dailyLoad).toBe(0);
    expect(series[5].dailyLoad).toBe(80);
  });

  it('ATL decays faster than CTL after a spike then rest', () => {
    // Big training spike on day 1, then rest for 20 days
    const loads: DailyLoad[] = [
      { date: '2026-04-01', load: 500 },
      { date: '2026-04-21', load: 0 },
    ];
    const series = computeTsbSeries(loads);
    const lastPoint = series[series.length - 1];
    // After 20 days of rest, ATL (τ=7) decays ~94% while CTL (τ=42) decays ~38%
    // So CTL > ATL → TSB > 0 (fresh)
    expect(lastPoint.tsb).toBeGreaterThan(0);
    expect(lastPoint.atl).toBeLessThan(lastPoint.ctl);
  });

  it('continuous heavy training produces negative TSB (fatigued)', () => {
    const loads: DailyLoad[] = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      load: 150,
    }));
    const series = computeTsbSeries(loads);
    const lastPoint = series[series.length - 1];
    // ATL rises faster than CTL → TSB goes negative
    expect(lastPoint.tsb).toBeLessThan(0);
  });
});

describe('computeTsbFromSessions', () => {
  it('computes TSB from sessions end-to-end', () => {
    const sessions = Array.from({ length: 7 }, (_, i) =>
      makeSession({
        id: `s-${i}`,
        timestamp: `2026-04-${String(i + 10).padStart(2, '0')}T06:30:00Z`,
        trainingType: i % 2 === 0 ? 'Strength' : 'Rest',
      })
    );
    const series = computeTsbFromSessions(sessions);
    expect(series.length).toBe(7);
    expect(series.every((p) => typeof p.atl === 'number')).toBe(true);
  });
});

describe('getLatestTsb', () => {
  it('returns null for empty sessions', () => {
    expect(getLatestTsb([])).toBeNull();
  });

  it('returns the last TSB point', () => {
    const sessions = [
      makeSession({ id: 'a', timestamp: '2026-04-14T06:30:00Z' }),
      makeSession({ id: 'b', timestamp: '2026-04-15T06:30:00Z' }),
    ];
    const latest = getLatestTsb(sessions)!;
    expect(latest).not.toBeNull();
    expect(latest.date).toBe('2026-04-15');
  });
});
