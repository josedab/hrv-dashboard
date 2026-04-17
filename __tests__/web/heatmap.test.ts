import { buildHeatmap, verdictColor } from '../../apps/coach-web/lib/heatmap';
import { isEncryptedBundle, installCipher, getCipher } from '../../apps/coach-web/lib/wasmCrypto';
import { Session } from '../../src/types';

function makeSession(date: string, verdict: 'go_hard' | 'moderate' | 'rest', rmssd = 50): Session {
  return {
    id: date,
    timestamp: `${date}T08:00:00Z`,
    durationSeconds: 180,
    rrIntervals: [],
    rmssd,
    sdnn: 0,
    meanHr: 60,
    pnn50: 0,
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

describe('coach-web heatmap', () => {
  it('builds a grid covering the requested window', () => {
    const now = new Date('2026-04-15T12:00:00Z');
    const sessions = [
      makeSession('2026-04-14', 'go_hard'),
      makeSession('2026-04-10', 'rest', 22),
    ];
    const grid = buildHeatmap(sessions, now, 30);
    expect(grid.weeks.length).toBeGreaterThan(0);
    const all = grid.weeks.flat();
    const apr14 = all.find((c) => c.date === '2026-04-14');
    expect(apr14?.verdict).toBe('go_hard');
    const apr10 = all.find((c) => c.date === '2026-04-10');
    expect(apr10?.verdict).toBe('rest');
    const blank = all.find((c) => c.date === '2026-04-09');
    expect(blank?.verdict).toBeNull();
  });

  it('keeps only the most recent reading per day', () => {
    const now = new Date('2026-04-15T12:00:00Z');
    const sessions: Session[] = [
      { ...makeSession('2026-04-15', 'rest', 20), timestamp: '2026-04-15T06:00:00Z' },
      { ...makeSession('2026-04-15', 'go_hard', 60), timestamp: '2026-04-15T09:00:00Z' },
    ];
    const grid = buildHeatmap(sessions, now, 7);
    const today = grid.weeks.flat().find((c) => c.date === '2026-04-15');
    expect(today?.verdict).toBe('go_hard');
    expect(today?.rmssd).toBe(60);
  });

  it('verdictColor returns distinct colors per verdict', () => {
    expect(verdictColor('go_hard')).toBe('#22C55E');
    expect(verdictColor('moderate')).toBe('#F59E0B');
    expect(verdictColor('rest')).toBe('#EF4444');
    expect(verdictColor(null)).toBe('#1E293B');
  });
});

describe('coach-web wasmCrypto', () => {
  it('detects the encrypted bundle magic', () => {
    const enc = new Uint8Array([0x48, 0x52, 0x56, 0x45, 0x00]);
    const plain = new Uint8Array([0x7b, 0x22, 0x61, 0x22]); // {"a"
    expect(isEncryptedBundle(enc)).toBe(true);
    expect(isEncryptedBundle(plain)).toBe(false);
  });

  it('throws until a cipher is installed, then resolves', () => {
    expect(() => getCipher()).toThrow(/No WASM cipher/);
    installCipher({
      decryptBundle: async (ct) => ct,
    });
    expect(getCipher()).toBeDefined();
  });
});
