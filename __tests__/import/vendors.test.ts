import {
  parseWhoopCsv,
  parseOuraJson,
  parseGarminCsv,
  parseImport,
  importHash,
} from '../../src/experimental/integrations/import/vendors';

describe('parseWhoopCsv', () => {
  const csv = `Cycle start time,Cycle end time,Recovery score %,Resting heart rate (bpm),Heart rate variability (ms)
2026-04-10T07:00:00Z,2026-04-11T07:00:00Z,82,52,55.4
2026-04-11T07:00:00Z,2026-04-12T07:00:00Z,67,55,40.1
2026-04-12T07:00:00Z,2026-04-13T07:00:00Z,,,not-a-number`;

  it('parses two valid rows and reports the bad one', () => {
    const r = parseWhoopCsv(csv);
    expect(r.sessions).toHaveLength(2);
    expect(r.sessions[0].rmssd).toBe(55.4);
    expect(r.sessions[0].meanHr).toBe(52);
    expect(r.sessions[0].perceivedReadiness).toBe(4);
    expect(r.errors).toHaveLength(1);
  });

  it('returns errors when required columns missing', () => {
    const r = parseWhoopCsv('foo,bar\n1,2');
    expect(r.errors[0].reason).toMatch(/required columns/i);
  });

  it('handles empty input', () => {
    expect(parseWhoopCsv('').sessions).toHaveLength(0);
  });
});

describe('parseOuraJson', () => {
  const json = JSON.stringify({
    daily_readiness: [
      { day: '2026-04-10', average_hrv: 60, score: 80 },
      { day: '2026-04-11', average_hrv: 45, score: 60 },
      { day: '2026-04-12', average_hrv: 0 },
    ],
    daily_sleep: [{ day: '2026-04-10', total_sleep_duration: 28800 }],
  });

  it('parses readings with HRV and pulls in sleep when available', () => {
    const r = parseOuraJson(json);
    expect(r.sessions).toHaveLength(2);
    expect(r.sessions[0].rmssd).toBe(60);
    expect(r.sessions[0].sleepHours).toBeCloseTo(8);
    expect(r.sessions[1].rmssd).toBe(45);
  });

  it('reports invalid JSON', () => {
    const r = parseOuraJson('{not json');
    expect(r.errors[0].reason).toMatch(/invalid json/i);
    expect(r.sessions).toHaveLength(0);
  });
});

describe('parseGarminCsv', () => {
  const csv = `Date,RMSSD,SDNN,Avg HR
2026-04-10,52.3,68.0,54
2026-04-11,bad,70,55`;

  it('parses RMSSD and Avg HR', () => {
    const r = parseGarminCsv(csv);
    expect(r.sessions).toHaveLength(1);
    expect(r.sessions[0].rmssd).toBe(52.3);
    expect(r.sessions[0].meanHr).toBe(54);
    expect(r.errors).toHaveLength(1);
  });

  it('errors when required columns missing', () => {
    const r = parseGarminCsv('foo\nbar');
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe('parseImport dispatch', () => {
  it('routes to whoop parser', () => {
    const r = parseImport('whoop', 'Cycle start time,Heart rate variability (ms)\n2026-04-10,50');
    expect(r.source).toBe('whoop');
  });

  it('returns not-implemented stub for elite_hrv', () => {
    const r = parseImport('elite_hrv', 'anything');
    expect(r.errors[0].reason).toMatch(/not yet implemented/);
  });
});

describe('importHash', () => {
  it('is stable for same source/id', () => {
    expect(importHash('whoop', 'abc')).toBe(importHash('whoop', 'abc'));
  });
  it('differs across sources', () => {
    expect(importHash('whoop', 'abc')).not.toBe(importHash('oura', 'abc'));
  });
});

describe('id stability', () => {
  it('re-imports produce the same session ids', () => {
    const csv = `Cycle start time,Heart rate variability (ms)\n2026-04-10T07:00:00Z,50`;
    const a = parseWhoopCsv(csv);
    const b = parseWhoopCsv(csv);
    expect(a.sessions[0].id).toBe(b.sessions[0].id);
  });
});
