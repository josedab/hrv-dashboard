jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
}));

import React from 'react';
import { WorkoutCard } from '../../src/components/WorkoutCard';
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

function asJson(element: React.ReactElement): string {
  return JSON.stringify(element, (key, value) => {
    if (key === '_owner' || key === '_store' || key === 'ref' || key === '$$typeof')
      return undefined;
    return value;
  });
}

describe('WorkoutCard', () => {
  it('renders five filled stars for go_hard verdict', () => {
    const out = asJson(WorkoutCard({ session: makeSession('go_hard'), sport: 'cycling' }));
    expect(out).toContain('★★★★★');
  });

  it('renders one star for rest verdict', () => {
    const out = asJson(WorkoutCard({ session: makeSession('rest'), sport: 'cycling' }));
    expect(out).toContain('★☆☆☆☆');
  });

  it('renders disclaimer text', () => {
    const out = asJson(WorkoutCard({ session: null, sport: 'cycling' }));
    expect(out.toLowerCase()).toContain('suggestion');
  });

  it('renders for null session', () => {
    const out = asJson(WorkoutCard({ session: null }));
    expect(out.length).toBeGreaterThan(0);
  });
});

