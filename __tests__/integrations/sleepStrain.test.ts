jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import {
  applyHealthInputs,
  computeIntegratedRecovery,
  _resetHealthModuleCache,
  SleepSummary,
  StrainSummary,
} from '../../src/experimental/integrations/sleepStrain';
import { Session, BaselineResult } from '../../src/types';

beforeEach(() => {
  _resetHealthModuleCache();
});

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    timestamp: '2026-04-15T06:30:00Z',
    durationSeconds: 300,
    rrIntervals: [800],
    rmssd: 50,
    sdnn: 25,
    meanHr: 60,
    pnn50: 10,
    artifactRate: 0,
    verdict: 'go_hard',
    perceivedReadiness: 5,
    trainingType: 'Cycling',
    notes: null,
    sleepHours: null,
    sleepQuality: null,
    stressLevel: null,
    source: 'chest_strap',
    ...overrides,
  };
}

const goodBaseline: BaselineResult = { median: 50, dayCount: 14, values: [] };

describe('applyHealthInputs', () => {
  it('fills in sleep hours when session has none', () => {
    const session = makeSession();
    const sleep: SleepSummary = {
      hoursTotal: 7.8,
      qualityEstimate: 4,
      startedAt: '2026-04-14T22:30:00Z',
      endedAt: '2026-04-15T06:00:00Z',
    };
    const out = applyHealthInputs(session, sleep, null);
    expect(out.sleepHours).toBe(7.8);
    expect(out.sleepQuality).toBe(4);
  });

  it('does not overwrite a manual sleep entry', () => {
    const session = makeSession({ sleepHours: 6, sleepQuality: 3 });
    const sleep: SleepSummary = {
      hoursTotal: 7.8,
      qualityEstimate: 5,
      startedAt: '2026-04-14T22:30:00Z',
      endedAt: '2026-04-15T06:00:00Z',
    };
    const out = applyHealthInputs(session, sleep, null);
    expect(out.sleepHours).toBe(6);
    expect(out.sleepQuality).toBe(3);
  });

  it('handles null sleep + strain gracefully', () => {
    const session = makeSession();
    const out = applyHealthInputs(session, null, null);
    expect(out).toEqual(session);
  });
});

describe('computeIntegratedRecovery', () => {
  it('returns null when baseline is missing', () => {
    expect(
      computeIntegratedRecovery(makeSession(), { median: 0, dayCount: 0, values: [] }, null)
    ).toBeNull();
  });

  it('returns the unmodified rule-based score for low strain', () => {
    const out = computeIntegratedRecovery(makeSession(), goodBaseline, null);
    expect(out).not.toBeNull();
    expect(out!.score).toBeGreaterThan(0);
  });

  it('penalizes the score for high strain', () => {
    const baseScore = computeIntegratedRecovery(makeSession(), goodBaseline, null)!.score;
    const highStrain: StrainSummary = { score: 100, activeKcal: 1500, workoutCount: 2 };
    const penalized = computeIntegratedRecovery(makeSession(), goodBaseline, highStrain)!.score;
    expect(penalized).toBeLessThan(baseScore);
  });

  it('does not let strain push score below 0', () => {
    const session = makeSession({
      rmssd: 1,
      sleepQuality: 1,
      stressLevel: 5,
      perceivedReadiness: 1,
    });
    const highStrain: StrainSummary = { score: 100, activeKcal: 5000, workoutCount: 5 };
    const out = computeIntegratedRecovery(session, goodBaseline, highStrain)!;
    expect(out.score).toBeGreaterThanOrEqual(0);
  });
});
