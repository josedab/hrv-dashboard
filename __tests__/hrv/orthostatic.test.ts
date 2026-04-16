import { computeOrthostaticResult } from '../../src/hrv/orthostatic';

describe('computeOrthostaticResult', () => {
  // Simulated supine: ~800ms RR intervals (75 bpm)
  const supineRR = Array.from({ length: 150 }, (_, i) => 800 + Math.sin(i * 0.3) * 15);
  // Simulated standing: ~650ms RR intervals (92 bpm) with more variability loss
  const standingRR = Array.from({ length: 150 }, (_, i) => 650 + Math.sin(i * 0.3) * 8);

  it('computes supine and standing metrics', () => {
    const result = computeOrthostaticResult(supineRR, standingRR);
    expect(result.supine.meanHr).toBeGreaterThan(0);
    expect(result.standing.meanHr).toBeGreaterThan(0);
    expect(result.standing.meanHr).toBeGreaterThan(result.supine.meanHr);
  });

  it('shows negative delta rMSSD (rMSSD drops on standing)', () => {
    const result = computeOrthostaticResult(supineRR, standingRR);
    expect(result.deltaRmssd).toBeLessThan(0);
  });

  it('shows positive delta HR (HR rises on standing)', () => {
    const result = computeOrthostaticResult(supineRR, standingRR);
    expect(result.deltaHr).toBeGreaterThan(0);
  });

  it('produces a reactivity score 0–100', () => {
    const result = computeOrthostaticResult(supineRR, standingRR);
    expect(result.reactivityScore).toBeGreaterThanOrEqual(0);
    expect(result.reactivityScore).toBeLessThanOrEqual(100);
  });

  it('provides an interpretation string', () => {
    const result = computeOrthostaticResult(supineRR, standingRR);
    expect(result.interpretation).toBeTruthy();
    expect(typeof result.interpretation).toBe('string');
  });

  it('detects blunted response when minimal change', () => {
    const sameRR = Array.from({ length: 150 }, () => 800);
    const result = computeOrthostaticResult(sameRR, sameRR);
    expect(result.interpretation).toContain('Blunted');
  });

  it('handles short arrays gracefully', () => {
    const result = computeOrthostaticResult([800, 810], [700, 710]);
    expect(result.supine.rmssd).toBeGreaterThanOrEqual(0);
    expect(result.standing.rmssd).toBeGreaterThanOrEqual(0);
  });
});
