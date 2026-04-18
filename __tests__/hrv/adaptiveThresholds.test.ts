import {
  computeAdaptiveVerdict,
  percentile,
  DEFAULT_ADAPTIVE,
} from '../../src/hrv/adaptiveThresholds';
import { Session, BaselineResult } from '../../src/types';

function mk(
  rmssd: number,
  day: string,
  label: number | null = null,
  verdict: Session['verdict'] = null
): Session {
  return {
    id: day + rmssd,
    timestamp: `${day}T07:00:00Z`,
    durationSeconds: 180,
    rrIntervals: [],
    rmssd,
    sdnn: rmssd,
    meanHr: 60,
    pnn50: 0,
    artifactRate: 0,
    verdict,
    perceivedReadiness: label,
    trainingType: null,
    notes: null,
    sleepHours: null,
    sleepQuality: null,
    stressLevel: null,
    source: 'chest_strap',
  };
}

describe('adaptive thresholds', () => {
  it('percentile returns correct quantiles', () => {
    expect(percentile([], 0.5)).toBe(0);
    expect(percentile([10, 20, 30, 40, 50], 0.0)).toBe(10);
    expect(percentile([10, 20, 30, 40, 50], 1.0)).toBe(50);
    expect(percentile([10, 20, 30, 40, 50], 0.5)).toBe(30);
  });

  it('falls back to baseline thresholds on cold start', () => {
    const baseline: BaselineResult = { median: 50, dayCount: 7, values: [] };
    const r = computeAdaptiveVerdict(45, [], baseline, {
      goHardThreshold: 0.95,
      moderateThreshold: 0.8,
    });
    expect(r.coldStart).toBe(true);
    expect(r.verdict).toBe('moderate');
  });

  it('returns null when no baseline and no history', () => {
    const r = computeAdaptiveVerdict(
      50,
      [],
      { median: 0, dayCount: 0, values: [] },
      {
        goHardThreshold: 0.95,
        moderateThreshold: 0.8,
      }
    );
    expect(r.verdict).toBeNull();
    expect(r.coldStart).toBe(true);
  });

  it('uses personal percentiles past the history threshold', () => {
    const sessions: Session[] = [];
    const base = new Date('2026-03-01T07:00:00Z');
    for (let i = 0; i < DEFAULT_ADAPTIVE.minHistoryDays; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      sessions.push(mk(40 + i, d.toISOString().slice(0, 10)));
    }
    const baseline: BaselineResult = { median: 55, dayCount: 7, values: [] };
    const r = computeAdaptiveVerdict(70, sessions, baseline, {
      goHardThreshold: 0.95,
      moderateThreshold: 0.8,
    });
    expect(r.coldStart).toBe(false);
    expect(r.verdict).toBe('go_hard');
    expect(r.cutoffs.hard).toBeGreaterThan(0);
    expect(r.cutoffs.rest).toBeLessThan(r.cutoffs.hard);
  });

  it('label feedback adjusts cutoffs (bounded)', () => {
    const sessions: Session[] = [];
    const base = new Date('2026-03-01T07:00:00Z');
    for (let i = 0; i < DEFAULT_ADAPTIVE.minHistoryDays; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      // verdict says "rest", user reports 5/5 → bias positive → lower cutoffs
      sessions.push(mk(40 + i, d.toISOString().slice(0, 10), 5, 'rest'));
    }
    const baseline: BaselineResult = { median: 55, dayCount: 7, values: [] };
    const noLabels = computeAdaptiveVerdict(
      50,
      sessions.map((s) => ({ ...s, perceivedReadiness: null })),
      baseline,
      {
        goHardThreshold: 0.95,
        moderateThreshold: 0.8,
      }
    );
    const withLabels = computeAdaptiveVerdict(50, sessions, baseline, {
      goHardThreshold: 0.95,
      moderateThreshold: 0.8,
    });
    expect(withLabels.cutoffs.hard).toBeLessThan(noLabels.cutoffs.hard);
  });
});
