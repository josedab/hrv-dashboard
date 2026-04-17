import { generateBriefWithCitations } from '../../src/ml/coach';
import { Session, VerdictType } from '../../src/types';

function mk(over: Partial<Session> = {}): Session {
  return {
    id: Math.random().toString(36).slice(2),
    timestamp: new Date().toISOString(),
    durationSeconds: 180,
    rrIntervals: [],
    rmssd: 50,
    sdnn: 60,
    meanHr: 60,
    pnn50: 20,
    artifactRate: 0,
    verdict: 'go_hard' as VerdictType,
    perceivedReadiness: null,
    trainingType: null,
    notes: null,
    sleepHours: 7.5,
    sleepQuality: null,
    stressLevel: null,
    source: 'chest_strap',
    ...over,
  };
}

describe('generateBriefWithCitations', () => {
  it('attaches evidence to every bullet', () => {
    const now = new Date('2026-04-15T08:00:00Z');
    const sessions: Session[] = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      sessions.push(mk({ timestamp: d.toISOString(), rmssd: 45 + (i < 7 ? 5 : 0) }));
    }
    const brief = generateBriefWithCitations(sessions, now);
    expect(brief.citedBullets.length).toBeGreaterThan(0);
    for (const b of brief.citedBullets) {
      expect(b.text.length).toBeGreaterThan(0);
      expect(b.evidence.length).toBeGreaterThan(0);
      for (const e of b.evidence) {
        expect(typeof e.metric).toBe('string');
        expect(['number', 'string']).toContain(typeof e.value);
      }
    }
  });

  it('recommendation always carries evidence', () => {
    const brief = generateBriefWithCitations([mk()], new Date());
    expect(brief.citedRecommendation.evidence.length).toBeGreaterThan(0);
  });
});
