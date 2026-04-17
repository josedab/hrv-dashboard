import {
  PushService,
  InMemoryTokenStore,
} from '../../src/workout/pushService';
import { generateWorkout } from '../../src/workout/generator';

function fakeFetch(ok = true, body: object = { id: 'abc123' }): typeof fetch {
  return jest.fn(async () =>
    new Response(JSON.stringify(body), {
      status: ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    })
  ) as unknown as typeof fetch;
}

describe('PushService', () => {
  it('isConnected respects expiry', async () => {
    const store = new InMemoryTokenStore();
    const svc = new PushService(store);
    await store.set('strava', { accessToken: 't', expiresAt: 0 });
    expect(await svc.isConnected('strava')).toBe(false);
    await store.set('strava', { accessToken: 't', expiresAt: Date.now() + 60_000 });
    expect(await svc.isConnected('strava')).toBe(true);
  });

  it('refuses to push when not connected', async () => {
    const svc = new PushService(new InMemoryTokenStore());
    const w = generateWorkout({ sport: 'cycling', verdict: 'go_hard' });
    const r = await svc.pushPlannedWorkout('strava', w, { date: '2026-04-15', fetchImpl: fakeFetch() });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not connected/);
  });

  it('refuses TP/Intervals push when externalId missing', async () => {
    const store = new InMemoryTokenStore();
    await store.set('trainingpeaks', { accessToken: 't' });
    const svc = new PushService(store);
    const w = generateWorkout({ sport: 'running', verdict: 'moderate' });
    const r = await svc.pushPlannedWorkout('trainingpeaks', w, {
      date: '2026-04-15',
      fetchImpl: fakeFetch(),
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/athlete id/);
  });

  it('pushes successfully when connected', async () => {
    const store = new InMemoryTokenStore();
    await store.set('strava', { accessToken: 't', expiresAt: Date.now() + 3_600_000 });
    const svc = new PushService(store);
    const w = generateWorkout({ sport: 'cycling', verdict: 'go_hard' });
    const r = await svc.pushPlannedWorkout('strava', w, {
      date: '2026-04-15',
      fetchImpl: fakeFetch(true, { id: '99' }),
    });
    expect(r.ok).toBe(true);
  });

  it('disconnect clears the token', async () => {
    const store = new InMemoryTokenStore();
    await store.set('intervals', { accessToken: 't', externalId: 'a1' });
    const svc = new PushService(store);
    await svc.disconnect('intervals');
    expect(await svc.isConnected('intervals')).toBe(false);
  });
});
