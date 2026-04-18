import {
  bucketRatio,
  buildPublication,
  aggregateTeam,
  suggestTeamSession,
  TeamMemberPublication,
} from '../../src/experimental/team/aggregation';
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

describe('bucketRatio', () => {
  it.each([
    [100, 'high'],
    [95, 'high'],
    [80, 'medium'],
    [85, 'medium'],
    [70, 'low'],
    [50, 'low'],
  ])('%i → %s', (input, expected) => {
    expect(bucketRatio(input)).toBe(expected);
  });
});

describe('buildPublication', () => {
  it('rounds %baseline to nearest 5%', () => {
    const p = buildPublication(mkSession({ rmssd: 47 }), 'm1', 50);
    expect(p?.ratioPct).toBe(95); // 94 → 95
  });

  it('returns null when verdict missing', () => {
    expect(buildPublication(mkSession({ verdict: null }), 'm1', 50)).toBeNull();
  });

  it('returns null when baseline missing or zero', () => {
    expect(buildPublication(mkSession(), 'm1', null)).toBeNull();
    expect(buildPublication(mkSession(), 'm1', 0)).toBeNull();
  });

  it('truncates note to 80 chars', () => {
    const long = 'x'.repeat(120);
    const p = buildPublication(mkSession(), 'm1', 50, long);
    expect(p?.note?.length).toBe(80);
  });
});

describe('aggregateTeam', () => {
  function pub(
    memberId: string,
    verdict: 'go_hard' | 'moderate' | 'rest',
    date = '2026-04-15'
  ): TeamMemberPublication {
    return { memberId, date, verdict, bucket: 'medium', ratioPct: 90 };
  }

  it('suppresses below k-anonymity threshold', () => {
    const rows = aggregateTeam([pub('a', 'go_hard'), pub('b', 'rest')], 3);
    expect(rows[0].suppressed).toBe(true);
    expect(rows[0].goHard).toBe(0);
    expect(rows[0].meanRatioPct).toBeNull();
  });

  it('aggregates when threshold met', () => {
    const rows = aggregateTeam([pub('a', 'go_hard'), pub('b', 'moderate'), pub('c', 'rest')], 3);
    expect(rows[0].suppressed).toBe(false);
    expect(rows[0].goHard + rows[0].moderate + rows[0].rest).toBe(3);
  });

  it('groups by date and sorts ascending', () => {
    const rows = aggregateTeam(
      [pub('a', 'go_hard', '2026-04-15'), pub('b', 'go_hard', '2026-04-14')],
      1
    );
    expect(rows[0].date).toBe('2026-04-14');
    expect(rows[1].date).toBe('2026-04-15');
  });
});

describe('suggestTeamSession', () => {
  it('suggests rest when ≥50% of members flagged rest', () => {
    const out = suggestTeamSession({
      date: 'd',
      members: 4,
      suppressed: false,
      goHard: 0,
      moderate: 1,
      rest: 3,
      meanRatioPct: 75,
    });
    expect(out.intensity).toBe('rest');
  });

  it('suggests hard when ≥60% of members ready hard', () => {
    const out = suggestTeamSession({
      date: 'd',
      members: 5,
      suppressed: false,
      goHard: 4,
      moderate: 1,
      rest: 0,
      meanRatioPct: 100,
    });
    expect(out.intensity).toBe('hard');
  });

  it('falls back to neutral when suppressed', () => {
    const out = suggestTeamSession({
      date: 'd',
      members: 2,
      suppressed: true,
      goHard: 0,
      moderate: 0,
      rest: 0,
      meanRatioPct: null,
    });
    expect(out.message.toLowerCase()).toContain('not enough');
  });
});
