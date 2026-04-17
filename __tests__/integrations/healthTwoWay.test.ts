jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('../../src/utils/healthSync', () => ({
  isHealthSyncAvailable: () => false,
  requestHealthPermissions: async () => false,
  syncSessionToHealth: async () => ({ ok: false, error: 'sdk not loaded' }),
}));

import { syncBoth, pullForReading } from '../../src/integrations/healthTwoWay';
import { Session } from '../../src/types';

function mk(over: Partial<Session> = {}): Session {
  return {
    id: 'x',
    timestamp: '2026-04-15T08:00:00Z',
    durationSeconds: 180,
    rrIntervals: [],
    rmssd: 50,
    sdnn: 50,
    meanHr: 55,
    pnn50: 30,
    artifactRate: 0,
    verdict: 'go_hard',
    perceivedReadiness: null,
    trainingType: null,
    notes: null,
    sleepHours: null,
    sleepQuality: null,
    stressLevel: null,
    source: 'chest_strap',
    ...over,
  };
}

describe('healthTwoWay', () => {
  it('pullForReading returns a complete shape even when SDKs are missing', async () => {
    const r = await pullForReading(new Date('2026-04-15T08:00:00Z'));
    expect(r).toMatchObject({
      sleepHours: null,
      sleepQuality: null,
      restingHr: null,
    });
  });

  it('syncBoth merges pulled data and reports push status', async () => {
    const result = await syncBoth(mk(), {
      sleepHours: 7,
      sleepQuality: 4,
      restingHr: 50,
      source: 'health_kit',
    });
    expect(result.merged.sleepHours).toBe(7);
    expect(result.merged.provenance.sleepHours).toBe('health_kit');
    // SDKs absent → push fails gracefully
    expect(result.pushed).toBe(false);
  });
});
