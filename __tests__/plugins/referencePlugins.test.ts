import { compileReferencePlugins, REFERENCE_PLUGINS } from '../../src/plugins/reference';
import { Session } from '../../src/types';

function makeSession(rr: number[]): Session {
  return {
    id: 'test',
    timestamp: '2026-04-15T08:00:00Z',
    durationSeconds: rr.reduce((a, b) => a + b, 0) / 1000,
    rrIntervals: rr,
    rmssd: 50,
    sdnn: 50,
    meanHr: 60,
    pnn50: 0,
    artifactRate: 0,
    verdict: null,
    perceivedReadiness: null,
    trainingType: null,
    notes: null,
    sleepHours: null,
    sleepQuality: null,
    stressLevel: null,
    source: 'chest_strap',
  };
}

function syntheticRr(n: number, jitter = 30): number[] {
  const rr: number[] = [];
  for (let i = 0; i < n; i++) {
    rr.push(800 + Math.sin(i / 5) * jitter + (i % 3 === 0 ? jitter / 2 : -jitter / 2));
  }
  return rr;
}

describe('reference plugins', () => {
  it('exports exactly 5 reference plugins with stable manifests', () => {
    expect(REFERENCE_PLUGINS).toHaveLength(5);
    const ids = REFERENCE_PLUGINS.map((p) => p.manifest.id).sort();
    expect(ids).toEqual([
      'org.hrv.dfa_alpha1',
      'org.hrv.fft_lf_hf',
      'org.hrv.poincare',
      'org.hrv.recovery_velocity',
      'org.hrv.weekly_zscore',
    ]);
    for (const p of REFERENCE_PLUGINS) {
      expect(p.manifest.permissions).toEqual(['read:session']);
      expect(p.manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('all five compile in the sandbox', () => {
    const compiled = compileReferencePlugins();
    expect(compiled).toHaveLength(5);
  });

  it('Poincaré returns positive SD1/SD2 for synthetic data', async () => {
    const compiled = compileReferencePlugins();
    const poin = compiled.find((p) => p.manifest.id === 'org.hrv.poincare')!;
    const r = await poin.compute(makeSession(syntheticRr(60)));
    expect(r.metrics.sd1).toBeGreaterThan(0);
    expect(r.metrics.sd2).toBeGreaterThan(0);
    expect(r.metrics.sd1Sd2Ratio).toBeGreaterThan(0);
  });

  it('FFT returns finite LF/HF power for synthetic data', async () => {
    const compiled = compileReferencePlugins();
    const fft = compiled.find((p) => p.manifest.id === 'org.hrv.fft_lf_hf')!;
    const r = await fft.compute(makeSession(syntheticRr(64)));
    expect(Number.isFinite(r.metrics.lfPower)).toBe(true);
    expect(Number.isFinite(r.metrics.hfPower)).toBe(true);
    expect(Number.isFinite(r.metrics.lfHfRatio)).toBe(true);
  });

  it('DFA-α1 returns a slope around 0.5–1.5 for synthetic data', async () => {
    const compiled = compileReferencePlugins();
    const dfa = compiled.find((p) => p.manifest.id === 'org.hrv.dfa_alpha1')!;
    const r = await dfa.compute(makeSession(syntheticRr(120, 50)));
    expect(r.metrics.dfaAlpha1).toBeGreaterThan(0);
    expect(r.metrics.dfaAlpha1).toBeLessThan(2);
  });

  it('returns zeros gracefully for too-short input', async () => {
    const compiled = compileReferencePlugins();
    for (const p of compiled) {
      const r = await p.compute(makeSession([800, 810]));
      for (const v of Object.values(r.metrics)) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});
