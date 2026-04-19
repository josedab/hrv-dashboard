import { generateNarrative, NarrativeContext } from '../../src/hrv/coachNarrative';
import { Session, BaselineResult } from '../../src/types';

function makeBaseline(median: number, dayCount: number): BaselineResult {
  return { median, dayCount, values: Array(dayCount).fill(median) };
}

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

function makeCtx(overrides: Partial<NarrativeContext> = {}): NarrativeContext {
  return {
    currentRmssd: 45,
    baseline: makeBaseline(42, 7),
    verdict: 'go_hard',
    recovery: {
      score: 80,
      label: 'Excellent',
      components: { hrv: 90, sleep: 75, stress: 70, readiness: 80 },
    },
    trendDirection: 'stable',
    trendPercent: 2,
    streak: 5,
    recentSessions: [makeSession()],
    ...overrides,
  };
}

describe('generateNarrative', () => {
  it('returns a non-empty brief for valid context', () => {
    const brief = generateNarrative(makeCtx());
    expect(brief.text.length).toBeGreaterThan(0);
    expect(brief.clauses.length).toBeGreaterThanOrEqual(1);
    expect(brief.emoji).toBe('🟢');
  });

  it('includes baseline clause when HRV is well above baseline', () => {
    const brief = generateNarrative(makeCtx({ currentRmssd: 50, baseline: makeBaseline(40, 7) }));
    expect(brief.text).toContain('above');
  });

  it('includes baseline clause when HRV is below baseline', () => {
    const brief = generateNarrative(
      makeCtx({ currentRmssd: 30, baseline: makeBaseline(40, 7), verdict: 'rest' })
    );
    expect(brief.text).toContain('below baseline');
    expect(brief.emoji).toBe('🔴');
  });

  it('includes trend clause for improving trend', () => {
    const brief = generateNarrative(makeCtx({ trendDirection: 'improving', trendPercent: 12 }));
    expect(brief.text).toContain('trending up');
  });

  it('includes trend clause for large decline', () => {
    const brief = generateNarrative(
      makeCtx({ trendDirection: 'declining', trendPercent: -18, verdict: 'rest' })
    );
    expect(brief.text).toContain('dropped');
  });

  it('includes sleep clause for poor sleep', () => {
    const brief = generateNarrative(
      makeCtx({
        recentSessions: [makeSession({ sleepHours: 4.5 })],
        verdict: 'moderate',
      })
    );
    expect(brief.text).toContain('sleep');
  });

  it('includes sleep clause for great sleep', () => {
    const brief = generateNarrative(
      makeCtx({ recentSessions: [makeSession({ sleepHours: 8.5 })] })
    );
    expect(brief.text).toContain('Great sleep');
  });

  it('includes streak clause for 14+ day streak', () => {
    const brief = generateNarrative(makeCtx({ streak: 14 }));
    expect(brief.text).toContain('14 consecutive days');
  });

  it('includes streak clause for 7+ day streak', () => {
    const brief = generateNarrative(makeCtx({ streak: 9 }));
    expect(brief.text).toContain('9-day streak');
  });

  it('includes training clause for two rest days before go_hard', () => {
    const sessions = [
      makeSession({ trainingType: 'Rest', timestamp: '2026-04-14T06:30:00Z' }),
      makeSession({ trainingType: 'Rest', timestamp: '2026-04-15T06:30:00Z' }),
    ];
    const brief = generateNarrative(makeCtx({ recentSessions: sessions, verdict: 'go_hard' }));
    expect(brief.text).toContain('rest days');
  });

  it('includes recovery clause for excellent score', () => {
    const brief = generateNarrative(
      makeCtx({
        recovery: {
          score: 90,
          label: 'Excellent',
          components: { hrv: 95, sleep: 85, stress: 80, readiness: 90 },
        },
      })
    );
    expect(brief.text).toContain('recovery score is excellent');
  });

  it('includes recovery clause for low score', () => {
    const brief = generateNarrative(
      makeCtx({
        recovery: {
          score: 30,
          label: 'Poor',
          components: { hrv: 25, sleep: 30, stress: 35, readiness: 30 },
        },
        verdict: 'rest',
      })
    );
    expect(brief.text).toContain('recovery score is low');
  });

  it('always ends with an action clause for a valid verdict', () => {
    const goHard = generateNarrative(makeCtx({ verdict: 'go_hard' }));
    expect(goHard.text).toContain('Push hard');

    const moderate = generateNarrative(makeCtx({ verdict: 'moderate' }));
    expect(moderate.text).toContain('moderate intensity');

    const rest = generateNarrative(makeCtx({ verdict: 'rest' }));
    expect(rest.text).toContain('easy today');
  });

  it('returns fallback narrative when no data available', () => {
    const brief = generateNarrative(
      makeCtx({
        verdict: null,
        baseline: makeBaseline(0, 0),
        recovery: null,
        trendPercent: 0,
        streak: 1,
        recentSessions: [],
      })
    );
    expect(brief.text).toContain('Keep recording');
    expect(brief.emoji).toBe('📊');
  });

  it('limits to 3 clauses max (2 context + 1 action)', () => {
    const brief = generateNarrative(
      makeCtx({
        currentRmssd: 50,
        baseline: makeBaseline(40, 7),
        trendDirection: 'improving',
        trendPercent: 20,
        streak: 30,
        recovery: {
          score: 95,
          label: 'Excellent',
          components: { hrv: 95, sleep: 95, stress: 95, readiness: 95 },
        },
        verdict: 'go_hard',
      })
    );
    expect(brief.clauses.length).toBeLessThanOrEqual(3);
  });
});
