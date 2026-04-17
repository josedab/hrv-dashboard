jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { mergeAutoPull, autoPullSleep } from '../../src/integrations/healthAutoPull';
import { Session } from '../../src/types';

function mkSession(over: Partial<Session> = {}): Session {
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

describe('mergeAutoPull', () => {
  it('fills sleep when manual is null', () => {
    const out = mergeAutoPull(mkSession(), {
      sleepHours: 7.5,
      sleepQuality: 4,
      source: 'health_kit',
    });
    expect(out.sleepHours).toBe(7.5);
    expect(out.sleepQuality).toBe(4);
    expect(out.provenance.sleepHours).toBe('health_kit');
    expect(out.provenance.sleepQuality).toBe('health_kit');
  });

  it('preserves manual entry over auto-pull', () => {
    const out = mergeAutoPull(mkSession({ sleepHours: 6 }), {
      sleepHours: 9,
      sleepQuality: 5,
      source: 'health_connect',
    });
    expect(out.sleepHours).toBe(6);
    expect(out.provenance.sleepHours).toBe('manual');
  });

  it('handles auto-pull with null values gracefully', () => {
    const out = mergeAutoPull(mkSession(), {
      sleepHours: null,
      sleepQuality: null,
      source: 'manual',
    });
    expect(out.sleepHours).toBeNull();
    expect(out.provenance.sleepHours).toBeUndefined();
  });

  it('marks stress provenance when present', () => {
    const out = mergeAutoPull(mkSession({ stressLevel: 3 }), {
      sleepHours: null,
      sleepQuality: null,
      source: 'manual',
    });
    expect(out.provenance.stressLevel).toBe('manual');
  });
});

describe('autoPullSleep', () => {
  it('returns null shape when health module unavailable', async () => {
    const result = await autoPullSleep();
    expect(result).toHaveProperty('sleepHours');
    expect(result).toHaveProperty('source');
  });
});
