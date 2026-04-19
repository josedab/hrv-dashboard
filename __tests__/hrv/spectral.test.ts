import { computeSpectralMetrics, MIN_RR_FOR_SPECTRAL, BANDS } from '../../src/hrv/spectral';

function generateSinusoidalRr(
  baseRr: number,
  amplitudeMs: number,
  freqHz: number,
  count: number
): number[] {
  const rr: number[] = [];
  let t = 0;
  for (let i = 0; i < count; i++) {
    const interval = baseRr + amplitudeMs * Math.sin(2 * Math.PI * freqHz * t);
    rr.push(interval);
    t += interval / 1000;
  }
  return rr;
}

describe('computeSpectralMetrics', () => {
  it('returns empty result for fewer than MIN_RR_FOR_SPECTRAL intervals', () => {
    const rr = Array(MIN_RR_FOR_SPECTRAL - 1).fill(800);
    const result = computeSpectralMetrics(rr);
    expect(result.totalPower).toBe(0);
    expect(result.sampleCount).toBe(MIN_RR_FOR_SPECTRAL - 1);
    expect(result.lf.absolute).toBe(0);
    expect(result.hf.absolute).toBe(0);
  });

  it('returns empty result for empty array', () => {
    const result = computeSpectralMetrics([]);
    expect(result.totalPower).toBe(0);
    expect(result.sampleCount).toBe(0);
  });

  it('detects LF-dominant power for 0.1 Hz signal (resonance breathing)', () => {
    // ~6 breaths per minute = 0.1 Hz → should appear in LF band (0.04–0.15 Hz)
    const rr = generateSinusoidalRr(900, 50, 0.1, 300);
    const result = computeSpectralMetrics(rr);

    expect(result.totalPower).toBeGreaterThan(0);
    expect(result.lf.absolute).toBeGreaterThan(result.hf.absolute);
    expect(result.lf.percent).toBeGreaterThan(30);
    expect(result.lf.peakHz).not.toBeNull();
    // Peak should be near 0.1 Hz
    expect(result.lf.peakHz!).toBeGreaterThanOrEqual(0.08);
    expect(result.lf.peakHz!).toBeLessThanOrEqual(0.13);
  });

  it('detects HF-dominant power for 0.25 Hz signal (normal breathing)', () => {
    // ~15 breaths per minute = 0.25 Hz → should appear in HF band (0.15–0.4 Hz)
    const rr = generateSinusoidalRr(800, 40, 0.25, 300);
    const result = computeSpectralMetrics(rr);

    expect(result.totalPower).toBeGreaterThan(0);
    expect(result.hf.absolute).toBeGreaterThan(result.lf.absolute);
    expect(result.hf.percent).toBeGreaterThan(30);
    expect(result.hf.peakHz).not.toBeNull();
    expect(result.hf.peakHz!).toBeGreaterThanOrEqual(0.2);
    expect(result.hf.peakHz!).toBeLessThanOrEqual(0.3);
  });

  it('computes LF/HF ratio > 1 for LF-dominant signal', () => {
    const rr = generateSinusoidalRr(900, 60, 0.1, 300);
    const result = computeSpectralMetrics(rr);
    expect(result.lfHfRatio).toBeGreaterThan(1);
  });

  it('computes LF/HF ratio < 1 for HF-dominant signal', () => {
    const rr = generateSinusoidalRr(800, 50, 0.25, 300);
    const result = computeSpectralMetrics(rr);
    expect(result.lfHfRatio).toBeLessThan(1);
  });

  it('band percentages sum to approximately 100%', () => {
    const rr = generateSinusoidalRr(900, 40, 0.15, 300);
    const result = computeSpectralMetrics(rr);
    const sum = result.vlf.percent + result.lf.percent + result.hf.percent;
    expect(sum).toBeGreaterThan(99);
    expect(sum).toBeLessThanOrEqual(101);
  });

  it('marks VLF as reliable for recordings > 2 minutes', () => {
    // 300 beats × ~800ms = ~240 seconds (4 min)
    const rr = generateSinusoidalRr(800, 30, 0.1, 300);
    const result = computeSpectralMetrics(rr);
    expect(result.vlfReliable).toBe(true);
  });

  it('marks VLF as unreliable for short recordings', () => {
    // 60 beats × ~800ms = ~48 seconds (< 2 min)
    const rr = generateSinusoidalRr(800, 30, 0.1, 60);
    const result = computeSpectralMetrics(rr);
    expect(result.vlfReliable).toBe(false);
  });

  it('handles constant RR intervals (no variability)', () => {
    const rr = Array(200).fill(800);
    const result = computeSpectralMetrics(rr);
    // Constant signal → near-zero spectral power (only DC component removed)
    expect(result.lfHfRatio).toBe(0);
  });

  it('returns correct sampleCount', () => {
    const rr = generateSinusoidalRr(800, 30, 0.1, 150);
    const result = computeSpectralMetrics(rr);
    expect(result.sampleCount).toBe(150);
  });
});

describe('BANDS constants', () => {
  it('has non-overlapping bands in ascending order', () => {
    expect(BANDS.vlf.hi).toBe(BANDS.lf.lo);
    expect(BANDS.lf.hi).toBe(BANDS.hf.lo);
    expect(BANDS.vlf.lo).toBeLessThan(BANDS.vlf.hi);
    expect(BANDS.lf.lo).toBeLessThan(BANDS.lf.hi);
    expect(BANDS.hf.lo).toBeLessThan(BANDS.hf.hi);
  });
});
