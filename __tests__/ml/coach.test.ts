import { generateWeeklyBrief, buildBriefFeatures, rewriteBriefWithLlm } from '../../src/ml/coach';
import { Session } from '../../src/types';

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'id',
    timestamp: new Date().toISOString(),
    durationSeconds: 180,
    rrIntervals: [],
    rmssd: 50,
    sdnn: 60,
    meanHr: 55,
    pnn50: 30,
    artifactRate: 0.01,
    verdict: 'go_hard',
    perceivedReadiness: null,
    trainingType: null,
    notes: null,
    sleepHours: 8,
    sleepQuality: null,
    stressLevel: null,
    source: 'chest_strap',
    ...overrides,
  };
}

function dayShift(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

describe('buildBriefFeatures', () => {
  const now = new Date('2026-04-15T08:00:00Z');

  it('returns zero-state for empty input', () => {
    const f = buildBriefFeatures([], now);
    expect(f.sessions).toBe(0);
    expect(f.rmssdMean7).toBeNull();
    expect(f.longestStreak).toBe(0);
  });

  it('counts sessions and verdict mix in window', () => {
    const sessions = [
      mkSession({ timestamp: dayShift(now, -1).toISOString(), verdict: 'go_hard', rmssd: 60 }),
      mkSession({ timestamp: dayShift(now, -2).toISOString(), verdict: 'rest', rmssd: 30 }),
      mkSession({ timestamp: dayShift(now, -3).toISOString(), verdict: 'moderate', rmssd: 45 }),
      mkSession({ timestamp: dayShift(now, -10).toISOString(), verdict: 'go_hard', rmssd: 70 }),
    ];
    const f = buildBriefFeatures(sessions, now, 7);
    expect(f.sessions).toBe(3);
    expect(f.hardDays).toBe(1);
    expect(f.moderateDays).toBe(1);
    expect(f.restDays).toBe(1);
  });

  it('computes streak of consecutive days', () => {
    const sessions = [
      mkSession({ timestamp: dayShift(now, -1).toISOString() }),
      mkSession({ timestamp: dayShift(now, -2).toISOString() }),
      mkSession({ timestamp: dayShift(now, -3).toISOString() }),
      mkSession({ timestamp: dayShift(now, -5).toISOString() }),
    ];
    const f = buildBriefFeatures(sessions, now, 7);
    expect(f.longestStreak).toBe(3);
  });
});

describe('generateWeeklyBrief', () => {
  const now = new Date('2026-04-15T08:00:00Z');

  it('handles empty input gracefully', () => {
    const brief = generateWeeklyBrief([], now);
    expect(brief.headline).toMatch(/no readings/i);
    expect(brief.disclaimer).toMatch(/not medical advice/i);
  });

  it('flags accumulating fatigue when many rest days', () => {
    const sessions = Array.from({ length: 4 }, (_, i) =>
      mkSession({ timestamp: dayShift(now, -i - 1).toISOString(), verdict: 'rest', rmssd: 30 })
    );
    const brief = generateWeeklyBrief(sessions, now);
    expect(brief.recommendation.toLowerCase()).toMatch(/easy|deload|recovery|rest/);
  });

  it('every brief includes the not-medical-advice disclaimer', () => {
    const sessions = [mkSession({ timestamp: dayShift(now, -1).toISOString() })];
    const brief = generateWeeklyBrief(sessions, now);
    expect(brief.disclaimer).toBeTruthy();
  });
});

describe('rewriteBriefWithLlm', () => {
  const baseBrief = {
    features: buildBriefFeatures([], new Date()),
    headline: 'orig',
    bullets: ['orig bullet'],
    recommendation: 'orig rec',
    disclaimer: 'd',
  };

  it('returns rewritten brief when LLM returns valid JSON', async () => {
    const fakeFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                headline: 'new',
                bullets: ['new bullet'],
                recommendation: 'new rec',
              }),
            },
          },
        ],
      }),
    } as unknown as Response);
    const out = await rewriteBriefWithLlm(
      baseBrief,
      { apiKey: 'k', model: 'gpt' },
      fakeFetch as unknown as typeof fetch
    );
    expect(out.headline).toBe('new');
    expect(out.recommendation).toBe('new rec');
    expect(out.disclaimer).toBe('d');
  });

  it('throws when API key missing', async () => {
    await expect(
      rewriteBriefWithLlm(baseBrief, { apiKey: '', model: 'gpt' })
    ).rejects.toThrow(/API key/);
  });

  it('falls back to draft when LLM JSON malformed', async () => {
    const fakeFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json' } }] }),
    } as unknown as Response);
    const out = await rewriteBriefWithLlm(
      baseBrief,
      { apiKey: 'k', model: 'gpt' },
      fakeFetch as unknown as typeof fetch
    );
    expect(out.headline).toBe('orig');
  });
});
