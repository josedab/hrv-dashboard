import { predictNextDay } from '../../src/hrv/prediction';
import { Session, BaselineResult } from '../../src/types';

function makeBaseline(median: number, dayCount: number): BaselineResult {
  return { median, dayCount, values: Array(dayCount).fill(median) };
}

function makeSession(daysAgo: number, rmssd: number, extra: Partial<Session> = {}): Session {
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
    source: 'chest_strap',
    ...extra,
  };
}

describe('predictNextDay', () => {
  const baseline = makeBaseline(40, 7);

  it('returns null with insufficient history', () => {
    const sessions = Array.from({ length: 3 }, (_, i) => makeSession(i, 40));
    expect(predictNextDay(sessions, baseline)).toBeNull();
  });

  it('returns null when baseline median is 0', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => makeSession(i, 40));
    expect(predictNextDay(sessions, makeBaseline(0, 0))).toBeNull();
  });

  it('predicts go_hard for upward trending HRV', () => {
    // Ascending rMSSD over 10 days
    const sessions = Array.from({ length: 10 }, (_, i) => makeSession(10 - i, 35 + i * 2));
    const result = predictNextDay(sessions, baseline)!;
    expect(result).not.toBeNull();
    expect(result.predictedRmssd).toBeGreaterThan(40);
    expect(result.likelyVerdict).toBe('go_hard');
    expect(result.confidence).toBe('low');
    expect(result.rationale).toContain('trending upward');
  });

  it('predicts rest for downward trending HRV', () => {
    // Descending rMSSD over 10 days
    const sessions = Array.from({ length: 10 }, (_, i) => makeSession(10 - i, 50 - i * 3));
    const result = predictNextDay(sessions, baseline)!;
    expect(result).not.toBeNull();
    expect(result.predictedRmssd).toBeLessThan(40);
    expect(result.likelyVerdict).toBe('rest');
    expect(result.rationale).toContain('trending downward');
  });

  it('returns medium confidence with 14-30 days', () => {
    const sessions = Array.from({ length: 20 }, (_, i) => makeSession(20 - i, 38 + Math.sin(i)));
    const result = predictNextDay(sessions, baseline)!;
    expect(result.confidence).toBe('medium');
    expect(result.historyDays).toBe(20);
  });

  it('returns high confidence with 30+ days', () => {
    const sessions = Array.from({ length: 35 }, (_, i) => makeSession(35 - i, 40 + (i % 5)));
    const result = predictNextDay(sessions, baseline)!;
    expect(result.confidence).toBe('high');
  });

  it('predicts moderate for stable trend near baseline', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => makeSession(10 - i, 36 + (i % 3)));
    const result = predictNextDay(sessions, baseline)!;
    expect(['moderate', 'go_hard']).toContain(result.likelyVerdict);
    expect(result.rationale).toContain('stable');
  });

  it('clamps prediction to physiological range', () => {
    // Extremely steep downtrend
    const sessions = Array.from({ length: 10 }, (_, i) => makeSession(10 - i, 100 - i * 15));
    const result = predictNextDay(sessions, baseline)!;
    expect(result.predictedRmssd).toBeGreaterThanOrEqual(5);
    expect(result.predictedRmssd).toBeLessThanOrEqual(200);
  });

  it('includes rationale text', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => makeSession(10 - i, 40));
    const result = predictNextDay(sessions, baseline)!;
    expect(result.rationale.length).toBeGreaterThan(10);
    expect(result.rationale).toContain('baseline');
  });

  it('deduplicates same-day sessions (uses first)', () => {
    const sessions = [
      makeSession(1, 42, { id: 'morning' }),
      makeSession(1, 38, { id: 'evening' }),
      ...Array.from({ length: 8 }, (_, i) => makeSession(i + 2, 40)),
    ];
    const result = predictNextDay(sessions, baseline)!;
    expect(result).not.toBeNull();
    // Should use 9 unique days, not 10 sessions
    expect(result.historyDays).toBe(9);
  });
});
