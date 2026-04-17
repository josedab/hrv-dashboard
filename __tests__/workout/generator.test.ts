import { generateWorkout, toZwoXml, WorkoutPrescription } from '../../src/workout/generator';
import { Session } from '../../src/types';

function makeSession(verdict: Session['verdict']): Session {
  return {
    id: 's1',
    timestamp: '2026-04-15T06:30:00Z',
    durationSeconds: 300,
    rrIntervals: [800],
    rmssd: 50,
    sdnn: 25,
    meanHr: 60,
    pnn50: 10,
    artifactRate: 0,
    verdict,
    perceivedReadiness: null,
    trainingType: null,
    notes: null,
    sleepHours: null,
    sleepQuality: null,
    stressLevel: null,
    source: 'chest_strap',
  };
}

describe('generateWorkout', () => {
  it('produces a high-intensity cycling block on Go Hard', () => {
    const w = generateWorkout({ sport: 'cycling', session: makeSession('go_hard') });
    expect(w.intensityStars).toBe(5);
    expect(w.blocks.some((b) => b.zone.label.includes('VO2'))).toBe(true);
  });

  it('produces a tempo session on Moderate', () => {
    const w = generateWorkout({ sport: 'cycling', session: makeSession('moderate') });
    expect(w.intensityStars).toBe(3);
    expect(w.blocks.some((b) => b.zone.label.includes('Tempo'))).toBe(true);
  });

  it('produces an active-recovery block on Rest', () => {
    const w = generateWorkout({ sport: 'cycling', session: makeSession('rest') });
    expect(w.intensityStars).toBe(1);
    expect(w.blocks[0].zone.label.includes('Recovery')).toBe(true);
  });

  it('produces a strength heavy day on Go Hard', () => {
    const w = generateWorkout({ sport: 'strength', session: makeSession('go_hard') });
    expect(w.headline.toLowerCase()).toContain('heavy');
  });

  it('produces a BJJ open mat when verdict is null', () => {
    const w = generateWorkout({ sport: 'bjj', session: makeSession(null) });
    expect(w.intensityStars).toBeLessThanOrEqual(2);
  });

  it('rest_day always produces a zero-block plan', () => {
    const w = generateWorkout({ sport: 'rest_day' });
    expect(w.blocks).toHaveLength(0);
    expect(w.intensityStars).toBe(0);
  });

  it('always includes a disclaimer', () => {
    const w = generateWorkout({ sport: 'running', session: makeSession('moderate') });
    expect(w.disclaimer).toBeTruthy();
  });
});

describe('toZwoXml', () => {
  it('produces valid XML envelope', () => {
    const w = generateWorkout({ sport: 'cycling', session: makeSession('go_hard') });
    const xml = toZwoXml(w, 'Jose');
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<workout_file>');
    expect(xml).toContain('</workout_file>');
    expect(xml).toContain('<sportType>bike</sportType>');
  });

  it('emits IntervalsT for repeated blocks and SteadyState otherwise', () => {
    const w = generateWorkout({ sport: 'cycling', session: makeSession('go_hard') });
    const xml = toZwoXml(w);
    expect(xml).toContain('IntervalsT');
    expect(xml).toContain('SteadyState');
  });

  it('escapes XML metacharacters in athlete name', () => {
    const w: WorkoutPrescription = generateWorkout({
      sport: 'cycling',
      session: makeSession('moderate'),
    });
    const xml = toZwoXml(w, 'Jose <hax>');
    expect(xml).toContain('Jose &lt;hax&gt;');
  });

  it('uses run sportType for running', () => {
    const w = generateWorkout({ sport: 'running', session: makeSession('go_hard') });
    expect(toZwoXml(w)).toContain('<sportType>run</sportType>');
  });
});
