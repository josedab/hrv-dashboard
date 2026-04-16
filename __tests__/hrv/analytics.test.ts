import {
  computeWeeklySummary,
  computeSleepHrvCorrelation,
  computeStressHrvCorrelation,
} from '../../src/hrv/analytics';
import { Session } from '../../src/types';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-id',
    timestamp: '2026-04-15T06:30:00Z',
    durationSeconds: 300,
    rrIntervals: [],
    rmssd: 40,
    sdnn: 20,
    meanHr: 65,
    pnn50: 15,
    artifactRate: 0.02,
    verdict: 'go_hard',
    perceivedReadiness: null,
    trainingType: null,
    notes: null,
    sleepHours: null,
    sleepQuality: null,
    stressLevel: null,
    source: 'chest_strap',
    ...overrides,
  };
}

describe('computeWeeklySummary', () => {
  it('returns zeros for empty sessions', () => {
    const summary = computeWeeklySummary([], []);
    expect(summary.avgRmssd).toBe(0);
    expect(summary.sessionCount).toBe(0);
    expect(summary.trendDirection).toBe('stable');
  });

  it('computes average rMSSD correctly', () => {
    const sessions = [
      makeSession({ rmssd: 30 }),
      makeSession({ rmssd: 40 }),
      makeSession({ rmssd: 50 }),
    ];
    const summary = computeWeeklySummary(sessions, []);
    expect(summary.avgRmssd).toBe(40);
    expect(summary.sessionCount).toBe(3);
  });

  it('detects improving trend when current > previous by >5%', () => {
    const current = [makeSession({ rmssd: 50 })];
    const previous = [makeSession({ rmssd: 40 })];
    const summary = computeWeeklySummary(current, previous);
    expect(summary.trendDirection).toBe('improving');
    expect(summary.trendPercent).toBeGreaterThan(5);
  });

  it('detects declining trend when current < previous by >5%', () => {
    const current = [makeSession({ rmssd: 30 })];
    const previous = [makeSession({ rmssd: 40 })];
    const summary = computeWeeklySummary(current, previous);
    expect(summary.trendDirection).toBe('declining');
    expect(summary.trendPercent).toBeLessThan(-5);
  });

  it('detects stable trend within ±5%', () => {
    const current = [makeSession({ rmssd: 41 })];
    const previous = [makeSession({ rmssd: 40 })];
    const summary = computeWeeklySummary(current, previous);
    expect(summary.trendDirection).toBe('stable');
  });

  it('identifies best and worst days', () => {
    const sessions = [
      makeSession({ rmssd: 30, timestamp: '2026-04-14T06:30:00Z' }),
      makeSession({ rmssd: 50, timestamp: '2026-04-15T06:30:00Z' }),
    ];
    const summary = computeWeeklySummary(sessions, []);
    expect(summary.bestDay!.rmssd).toBe(50);
    expect(summary.worstDay!.rmssd).toBe(30);
  });

  it('counts verdicts correctly', () => {
    const sessions = [
      makeSession({ verdict: 'go_hard' }),
      makeSession({ verdict: 'go_hard' }),
      makeSession({ verdict: 'moderate' }),
      makeSession({ verdict: 'rest' }),
    ];
    const summary = computeWeeklySummary(sessions, []);
    expect(summary.verdictCounts.go_hard).toBe(2);
    expect(summary.verdictCounts.moderate).toBe(1);
    expect(summary.verdictCounts.rest).toBe(1);
  });
});

describe('computeSleepHrvCorrelation', () => {
  it('returns null with fewer than 5 sessions with sleep data', () => {
    const sessions = [
      makeSession({ sleepQuality: 4, rmssd: 40 }),
      makeSession({ sleepQuality: 3, rmssd: 35 }),
    ];
    expect(computeSleepHrvCorrelation(sessions)).toBeNull();
  });

  it('computes positive correlation when sleep quality correlates with rMSSD', () => {
    const sessions = [
      makeSession({ sleepQuality: 5, rmssd: 50 }),
      makeSession({ sleepQuality: 4, rmssd: 45 }),
      makeSession({ sleepQuality: 3, rmssd: 38 }),
      makeSession({ sleepQuality: 2, rmssd: 30 }),
      makeSession({ sleepQuality: 1, rmssd: 22 }),
    ];
    const result = computeSleepHrvCorrelation(sessions)!;
    expect(result).not.toBeNull();
    expect(result.correlation).toBeGreaterThan(0.5);
    expect(result.factor).toBe('Sleep Quality');
  });
});

describe('computeStressHrvCorrelation', () => {
  it('returns null with insufficient data', () => {
    expect(computeStressHrvCorrelation([])).toBeNull();
  });

  it('computes negative correlation when stress inversely correlates with rMSSD', () => {
    const sessions = [
      makeSession({ stressLevel: 1, rmssd: 50 }),
      makeSession({ stressLevel: 2, rmssd: 42 }),
      makeSession({ stressLevel: 3, rmssd: 37 }),
      makeSession({ stressLevel: 4, rmssd: 28 }),
      makeSession({ stressLevel: 5, rmssd: 20 }),
    ];
    const result = computeStressHrvCorrelation(sessions)!;
    expect(result).not.toBeNull();
    expect(result.correlation).toBeLessThan(-0.5);
  });
});
