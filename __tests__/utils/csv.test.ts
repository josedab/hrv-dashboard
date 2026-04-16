import { sessionsToCSV } from '../../src/utils/csv';
import { Session } from '../../src/types';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-id-1',
    timestamp: '2024-01-15T08:30:00Z',
    durationSeconds: 300,
    rrIntervals: [800, 810, 790],
    rmssd: 14.36,
    sdnn: 8.16,
    meanHr: 75.0,
    pnn50: 33.3,
    artifactRate: 0.0,
    verdict: 'go_hard',
    perceivedReadiness: 4,
    trainingType: 'Strength',
    notes: 'Felt great',
    sleepHours: null,
    sleepQuality: null,
    stressLevel: null,
    source: 'chest_strap',
    ...overrides,
  };
}

describe('sessionsToCSV', () => {
  it('produces correct header row', () => {
    const csv = sessionsToCSV([]);
    const headers = csv.split('\n')[0];
    expect(headers).toBe(
      'id,timestamp,duration_seconds,rmssd,sdnn,mean_hr,pnn50,artifact_rate,verdict,perceived_readiness,training_type,notes,rr_interval_count,sleep_hours,sleep_quality,stress_level'
    );
  });

  it('exports a single session correctly', () => {
    const session = makeSession();
    const csv = sessionsToCSV([session]);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(2); // header + 1 data row
    const row = lines[1];
    expect(row).toContain('test-id-1');
    expect(row).toContain('2024-01-15T08:30:00Z');
    expect(row).toContain('300');
    expect(row).toContain('14.36');
    expect(row).toContain('go_hard');
    expect(row).toContain('Strength');
    expect(row).toContain('Felt great');
    expect(row).toContain('3'); // rrIntervals.length
  });

  it('exports multiple sessions', () => {
    const sessions = [
      makeSession({ id: 'session-1' }),
      makeSession({ id: 'session-2', verdict: 'rest' }),
      makeSession({ id: 'session-3', verdict: 'moderate' }),
    ];
    const csv = sessionsToCSV(sessions);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(4); // header + 3 data rows
    expect(lines[1]).toContain('session-1');
    expect(lines[2]).toContain('session-2');
    expect(lines[3]).toContain('session-3');
  });

  it('handles null verdict', () => {
    const session = makeSession({ verdict: null });
    const csv = sessionsToCSV([session]);
    const lines = csv.split('\n');
    const fields = lines[1].split(',');
    // verdict is the 9th field (index 8)
    expect(fields[8]).toBe('');
  });

  it('handles null perceivedReadiness', () => {
    const session = makeSession({ perceivedReadiness: null });
    const csv = sessionsToCSV([session]);
    const lines = csv.split('\n');
    const fields = lines[1].split(',');
    // perceivedReadiness is the 10th field (index 9)
    expect(fields[9]).toBe('');
  });

  it('handles null trainingType', () => {
    const session = makeSession({ trainingType: null });
    const csv = sessionsToCSV([session]);
    const lines = csv.split('\n');
    const fields = lines[1].split(',');
    // trainingType is the 11th field (index 10)
    expect(fields[10]).toBe('');
  });

  it('handles null notes', () => {
    const session = makeSession({ notes: null });
    const csv = sessionsToCSV([session]);
    const lines = csv.split('\n');
    // notes should be empty string
    expect(lines[1]).not.toContain('null');
  });

  it('escapes notes containing commas', () => {
    const session = makeSession({ notes: 'felt good, but tired' });
    const csv = sessionsToCSV([session]);
    expect(csv).toContain('"felt good, but tired"');
  });

  it('escapes notes containing double quotes', () => {
    const session = makeSession({ notes: 'felt "great" today' });
    const csv = sessionsToCSV([session]);
    expect(csv).toContain('"felt ""great"" today"');
  });

  it('escapes notes containing newlines', () => {
    const session = makeSession({ notes: 'line1\nline2' });
    const csv = sessionsToCSV([session]);
    expect(csv).toContain('"line1\nline2"');
  });

  it('formats numeric fields correctly', () => {
    const session = makeSession({
      rmssd: 14.3678,
      sdnn: 8.1623,
      meanHr: 74.567,
      pnn50: 33.333,
      artifactRate: 0.0512,
    });
    const csv = sessionsToCSV([session]);
    const lines = csv.split('\n');
    const fields = lines[1].split(',');

    // rmssd toFixed(2)
    expect(fields[3]).toBe('14.37');
    // sdnn toFixed(2)
    expect(fields[4]).toBe('8.16');
    // meanHr toFixed(1)
    expect(fields[5]).toBe('74.6');
    // pnn50 toFixed(1)
    expect(fields[6]).toBe('33.3');
    // artifactRate toFixed(4)
    expect(fields[7]).toBe('0.0512');
  });

  it('outputs rr_interval_count field', () => {
    const session = makeSession({ rrIntervals: [800, 810, 790, 800, 815] });
    const csv = sessionsToCSV([session]);
    const lines = csv.split('\n');
    const fields = lines[1].split(',');
    // rr_interval_count is at index 12 (0-based)
    expect(fields[12]).toBe('5');
  });

  it('outputs sleep and stress fields', () => {
    const session = makeSession({ sleepHours: 7, sleepQuality: 4, stressLevel: 2 });
    const csv = sessionsToCSV([session]);
    const lines = csv.split('\n');
    const fields = lines[1].split(',');
    expect(fields[13]).toBe('7');
    expect(fields[14]).toBe('4');
    expect(fields[15]).toBe('2');
  });
});
