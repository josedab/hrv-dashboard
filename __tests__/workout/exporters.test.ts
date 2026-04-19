import {
  pushToStrava,
  pushToTrainingPeaks,
  pushToIntervalsIcu,
  renderPlainText,
  renderIntervalsDoc,
} from '../../src/workout/exporters';
import { generateWorkout } from '../../src/workout/generator';

function mkWorkout() {
  return generateWorkout({ sport: 'cycling', verdict: 'go_hard' });
}

function fakeOk(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function fakeErr(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => '',
  } as Response;
}

describe('renderPlainText', () => {
  it('lists each block with duration + zone label', () => {
    const txt = renderPlainText(mkWorkout());
    expect(txt).toContain('Zone');
    expect(txt).toContain('min');
    expect(txt.toLowerCase()).toContain('not medical');
  });
});

describe('renderIntervalsDoc', () => {
  it('outputs steps with %FTP power values', () => {
    const doc = renderIntervalsDoc(mkWorkout());
    expect(doc.steps.length).toBeGreaterThan(0);
    for (const s of doc.steps) {
      expect(s.power.units).toBe('percent_ftp');
      expect(s.power.value).toBeGreaterThan(0);
    }
  });
});

describe('pushToStrava', () => {
  it('returns external id on success', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(fakeOk({ id: 12345 }));
    const r = await pushToStrava(mkWorkout(), '2026-04-15', {
      accessToken: 't',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.ok).toBe(true);
    expect(r.externalId).toBe('12345');
    expect(r.url).toContain('strava.com');
  });

  it('returns error on non-2xx', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(fakeErr(401));
    const r = await pushToStrava(mkWorkout(), '2026-04-15', {
      accessToken: 't',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('401');
  });
});

describe('pushToTrainingPeaks', () => {
  it('uploads ZWO XML payload', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(fakeOk({ workoutId: 99 }));
    const r = await pushToTrainingPeaks(mkWorkout(), '2026-04-15', 'athlete-1', {
      accessToken: 't',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.ok).toBe(true);
    expect(r.externalId).toBe('99');
    const call = fetchImpl.mock.calls[0];
    expect(call[1].body).toContain('ZWO');
  });
});

describe('pushToIntervalsIcu', () => {
  it('posts workout_doc with structured steps', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(fakeOk({ id: 'evt-1' }));
    const r = await pushToIntervalsIcu(mkWorkout(), '2026-04-15', 'a', {
      accessToken: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.ok).toBe(true);
    expect(r.externalId).toBe('evt-1');
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.workout_doc.steps.length).toBeGreaterThan(0);
  });
});
