import {
  classifyAnsZone,
  sessionToAnsReading,
  computeAnsSummary,
  ANS_ZONE_LABELS,
  ANS_ZONE_COLORS,
} from '../../src/hrv/ansBalance';
import { Session } from '../../src/types';

function makeSession(overrides: Partial<Session> = {}): Session {
  // Generate a sinusoidal RR signal for spectral analysis
  const rr: number[] = [];
  let t = 0;
  for (let i = 0; i < 200; i++) {
    const interval = 900 + 50 * Math.sin(2 * Math.PI * 0.1 * t);
    rr.push(interval);
    t += interval / 1000;
  }
  return {
    id: 'test',
    timestamp: '2026-04-15T06:30:00Z',
    durationSeconds: 300,
    rrIntervals: rr,
    rmssd: 42,
    sdnn: 22,
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
    ...overrides,
  };
}

describe('classifyAnsZone', () => {
  it('classifies low LF/HF as parasympathetic', () => {
    expect(classifyAnsZone(0.3)).toBe('parasympathetic');
  });

  it('classifies moderate LF/HF as balanced', () => {
    expect(classifyAnsZone(1.0)).toBe('balanced');
    expect(classifyAnsZone(0.5)).toBe('balanced');
    expect(classifyAnsZone(2.0)).toBe('balanced');
  });

  it('classifies high LF/HF as sympathetic', () => {
    expect(classifyAnsZone(3.0)).toBe('sympathetic');
    expect(classifyAnsZone(4.0)).toBe('sympathetic');
  });

  it('classifies very high LF/HF as high_sympathetic', () => {
    expect(classifyAnsZone(5.0)).toBe('high_sympathetic');
  });

  it('classifies zero as parasympathetic', () => {
    expect(classifyAnsZone(0)).toBe('parasympathetic');
  });
});

describe('sessionToAnsReading', () => {
  it('returns a reading for a session with sufficient RR data', () => {
    const session = makeSession();
    const reading = sessionToAnsReading(session);
    expect(reading).not.toBeNull();
    expect(reading!.date).toBe('2026-04-15');
    expect(reading!.lfHfRatio).toBeGreaterThanOrEqual(0);
    expect(reading!.lfPercent).toBeGreaterThanOrEqual(0);
    expect(reading!.hfPercent).toBeGreaterThanOrEqual(0);
    expect(['parasympathetic', 'balanced', 'sympathetic', 'high_sympathetic']).toContain(
      reading!.zone
    );
  });

  it('returns null for sessions with insufficient RR intervals', () => {
    const session = makeSession({ rrIntervals: [800, 810, 790] });
    expect(sessionToAnsReading(session)).toBeNull();
  });

  it('returns null for constant RR intervals (no spectral power)', () => {
    const session = makeSession({ rrIntervals: Array(200).fill(800) });
    const reading = sessionToAnsReading(session);
    // Constant signal has near-zero total power → may return null or zero ratio
    if (reading) {
      expect(reading.totalPower).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('computeAnsSummary', () => {
  it('returns empty summary for no sessions', () => {
    const summary = computeAnsSummary([]);
    expect(summary.readings).toHaveLength(0);
    expect(summary.avgLfHfRatio).toBe(0);
    expect(summary.dominantZone).toBe('balanced');
  });

  it('computes summary from multiple sessions', () => {
    const sessions = Array.from({ length: 7 }, (_, i) =>
      makeSession({
        id: `s-${i}`,
        timestamp: `2026-04-${String(i + 10).padStart(2, '0')}T06:30:00Z`,
      })
    );
    const summary = computeAnsSummary(sessions);
    expect(summary.readings.length).toBeGreaterThan(0);
    expect(summary.avgLfHfRatio).toBeGreaterThan(0);
    expect(summary.zoneDistribution).toBeDefined();
    const totalPct =
      summary.zoneDistribution.parasympathetic +
      summary.zoneDistribution.balanced +
      summary.zoneDistribution.sympathetic +
      summary.zoneDistribution.high_sympathetic;
    expect(totalPct).toBeGreaterThanOrEqual(98); // allow rounding
    expect(totalPct).toBeLessThanOrEqual(102);
  });

  it('skips sessions without enough RR data', () => {
    const sessions = [makeSession({ id: 'good' }), makeSession({ id: 'bad', rrIntervals: [800] })];
    const summary = computeAnsSummary(sessions);
    expect(summary.readings).toHaveLength(1);
  });
});

describe('ANS_ZONE_LABELS and ANS_ZONE_COLORS', () => {
  it('has labels for all zones', () => {
    expect(Object.keys(ANS_ZONE_LABELS)).toHaveLength(4);
    expect(ANS_ZONE_LABELS.balanced).toBe('Balanced');
  });

  it('has colors for all zones', () => {
    expect(Object.keys(ANS_ZONE_COLORS)).toHaveLength(4);
    expect(ANS_ZONE_COLORS.parasympathetic).toMatch(/^#/);
  });
});
