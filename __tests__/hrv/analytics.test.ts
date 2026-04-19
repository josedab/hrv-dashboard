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

  it('reports weak interpretation for no correlation', () => {
    const sessions = [
      makeSession({ stressLevel: 1, rmssd: 30 }),
      makeSession({ stressLevel: 5, rmssd: 31 }),
      makeSession({ stressLevel: 2, rmssd: 50 }),
      makeSession({ stressLevel: 4, rmssd: 49 }),
      makeSession({ stressLevel: 3, rmssd: 40 }),
    ];
    const result = computeStressHrvCorrelation(sessions)!;
    expect(result).not.toBeNull();
    expect(result.interpretation).toBe('Weak or no clear relationship');
  });

  it('ignores sessions with null stress', () => {
    const sessions = [
      makeSession({ stressLevel: null, rmssd: 50 }),
      makeSession({ stressLevel: null, rmssd: 40 }),
      makeSession({ stressLevel: 1, rmssd: 30 }),
    ];
    expect(computeStressHrvCorrelation(sessions)).toBeNull();
  });
});

describe('computeWeeklySummary edge cases', () => {
  it('computes streak of consecutive days', () => {
    const sessions = [
      makeSession({ timestamp: '2026-04-14T06:30:00Z' }),
      makeSession({ timestamp: '2026-04-15T06:30:00Z' }),
      makeSession({ timestamp: '2026-04-16T06:30:00Z' }),
    ];
    const summary = computeWeeklySummary(sessions, []);
    expect(summary.streakInPeriod).toBe(3);
  });

  it('streak resets on gap', () => {
    const sessions = [
      makeSession({ timestamp: '2026-04-14T06:30:00Z' }),
      makeSession({ timestamp: '2026-04-15T06:30:00Z' }),
      // gap on 04-16
      makeSession({ timestamp: '2026-04-17T06:30:00Z' }),
    ];
    const summary = computeWeeklySummary(sessions, []);
    expect(summary.streakInPeriod).toBe(2);
  });

  it('single session has streak of 1', () => {
    const sessions = [makeSession({ timestamp: '2026-04-14T06:30:00Z' })];
    const summary = computeWeeklySummary(sessions, []);
    expect(summary.streakInPeriod).toBe(1);
  });

  it('deduplicates same-day sessions for streak', () => {
    const sessions = [
      makeSession({ timestamp: '2026-04-14T06:30:00Z', id: 'a' }),
      makeSession({ timestamp: '2026-04-14T07:00:00Z', id: 'b' }),
      makeSession({ timestamp: '2026-04-15T06:30:00Z', id: 'c' }),
    ];
    const summary = computeWeeklySummary(sessions, []);
    expect(summary.streakInPeriod).toBe(2);
  });

  it('handles zero previous average gracefully', () => {
    const current = [makeSession({ rmssd: 50 })];
    const summary = computeWeeklySummary(current, []);
    expect(summary.trendDirection).toBe('stable');
    expect(summary.trendPercent).toBe(0);
  });

  it('computes median rMSSD correctly', () => {
    const sessions = [
      makeSession({ rmssd: 10 }),
      makeSession({ rmssd: 50 }),
      makeSession({ rmssd: 30 }),
    ];
    const summary = computeWeeklySummary(sessions, []);
    expect(summary.medianRmssd).toBe(30);
  });

  it('computes average HR across sessions', () => {
    const sessions = [makeSession({ meanHr: 60 }), makeSession({ meanHr: 70 })];
    const summary = computeWeeklySummary(sessions, []);
    expect(summary.avgHr).toBe(65);
  });

  it('skips null verdicts in verdict counts', () => {
    const sessions = [makeSession({ verdict: null }), makeSession({ verdict: 'go_hard' })];
    const summary = computeWeeklySummary(sessions, []);
    expect(summary.verdictCounts.go_hard).toBe(1);
    expect(summary.verdictCounts.moderate).toBe(0);
    expect(summary.verdictCounts.rest).toBe(0);
  });
});

describe('computeSleepHrvCorrelation edge cases', () => {
  it('ignores sessions with null sleep quality', () => {
    const sessions = [
      makeSession({ sleepQuality: null, rmssd: 50 }),
      makeSession({ sleepQuality: 4, rmssd: 40 }),
      makeSession({ sleepQuality: 3, rmssd: 35 }),
    ];
    expect(computeSleepHrvCorrelation(sessions)).toBeNull();
  });

  it('reports correct sample size', () => {
    const sessions = [
      makeSession({ sleepQuality: 5, rmssd: 50 }),
      makeSession({ sleepQuality: 4, rmssd: 45 }),
      makeSession({ sleepQuality: 3, rmssd: 38 }),
      makeSession({ sleepQuality: 2, rmssd: 30 }),
      makeSession({ sleepQuality: 1, rmssd: 22 }),
      makeSession({ sleepQuality: null, rmssd: 55 }),
    ];
    const result = computeSleepHrvCorrelation(sessions)!;
    expect(result.sampleSize).toBe(5);
  });
});
