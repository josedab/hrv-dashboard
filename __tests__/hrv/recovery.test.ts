import { computeRecoveryScore, estimateTrainingLoad, computeWeeklyLoad } from '../../src/hrv/recovery';
import { Session, BaselineResult } from '../../src/types';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-id',
    timestamp: '2026-04-15T06:30:00Z',
    durationSeconds: 300,
    rrIntervals: [800, 810, 795, 820],
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
    ...overrides,
  };
}

const goodBaseline: BaselineResult = { median: 40, dayCount: 7, values: [38, 40, 42, 39, 41, 43, 40] };
const insufficientBaseline: BaselineResult = { median: 40, dayCount: 3, values: [38, 40, 42] };

describe('computeRecoveryScore', () => {
  it('returns null when baseline has insufficient days', () => {
    expect(computeRecoveryScore(makeSession(), insufficientBaseline)).toBeNull();
  });

  it('returns null when baseline median is zero', () => {
    expect(computeRecoveryScore(makeSession(), { median: 0, dayCount: 7, values: [] })).toBeNull();
  });

  it('computes score with all defaults (no subjective data)', () => {
    const result = computeRecoveryScore(makeSession({ rmssd: 40 }), goodBaseline);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThanOrEqual(0);
    expect(result!.score).toBeLessThanOrEqual(100);
    expect(result!.label).toBeDefined();
    expect(result!.components.sleep).toBe(50); // neutral default
    expect(result!.components.stress).toBe(50); // neutral default
    expect(result!.components.readiness).toBe(50); // neutral default
  });

  it('gives higher score when all signals are positive', () => {
    const goodSession = makeSession({
      rmssd: 45,
      sleepQuality: 5,
      stressLevel: 1,
      perceivedReadiness: 5,
    });
    const result = computeRecoveryScore(goodSession, goodBaseline)!;
    expect(result.score).toBeGreaterThan(80);
    expect(result.label).toBe('Excellent');
  });

  it('gives lower score when all signals are negative', () => {
    const badSession = makeSession({
      rmssd: 20,
      sleepQuality: 1,
      stressLevel: 5,
      perceivedReadiness: 1,
    });
    const result = computeRecoveryScore(badSession, goodBaseline)!;
    expect(result.score).toBeLessThan(40);
    expect(result.label).toBe('Poor');
  });

  it('caps HRV ratio at 120%', () => {
    const highHrv = makeSession({ rmssd: 80 }); // 200% of baseline
    const result = computeRecoveryScore(highHrv, goodBaseline)!;
    expect(result.components.hrv).toBeLessThanOrEqual(100);
  });
});

describe('estimateTrainingLoad', () => {
  it('returns 0 for sessions with no training type', () => {
    expect(estimateTrainingLoad(makeSession())).toBe(0);
  });

  it('returns higher load for BJJ than Rest', () => {
    const bjj = estimateTrainingLoad(makeSession({ trainingType: 'BJJ' }));
    const rest = estimateTrainingLoad(makeSession({ trainingType: 'Rest' }));
    expect(bjj).toBeGreaterThan(rest);
  });

  it('scales by perceived readiness', () => {
    const low = estimateTrainingLoad(makeSession({ trainingType: 'Strength', perceivedReadiness: 1 }));
    const high = estimateTrainingLoad(makeSession({ trainingType: 'Strength', perceivedReadiness: 5 }));
    expect(high).toBeGreaterThan(low);
  });
});

describe('computeWeeklyLoad', () => {
  it('returns 0 for empty sessions', () => {
    expect(computeWeeklyLoad([])).toBe(0);
  });

  it('sums training loads', () => {
    const sessions = [
      makeSession({ trainingType: 'BJJ' }),
      makeSession({ trainingType: 'Strength' }),
      makeSession({ trainingType: 'Rest' }),
    ];
    const load = computeWeeklyLoad(sessions);
    expect(load).toBeGreaterThan(0);
  });
});
