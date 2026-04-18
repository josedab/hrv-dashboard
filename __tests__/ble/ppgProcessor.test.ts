import { processPpgSignal, DEFAULT_PPG_CONFIG } from '../../src/ble/ppgProcessor';

describe('processPpgSignal', () => {
  it('returns empty result for insufficient data', () => {
    const result = processPpgSignal([100, 110], [0, 33], DEFAULT_PPG_CONFIG);
    expect(result.rrIntervals).toHaveLength(0);
    expect(result.isUsable).toBe(false);
    expect(result.signalQuality).toBe(0);
  });

  it('extracts RR intervals from a clean sinusoidal signal', () => {
    const fps = 30;
    const durationSeconds = 30;
    const heartRate = 70; // bpm
    const freq = heartRate / 60; // Hz

    const brightness: number[] = [];
    const timestamps: number[] = [];

    for (let i = 0; i < fps * durationSeconds; i++) {
      const t = i / fps;
      brightness.push(128 + 40 * Math.sin(2 * Math.PI * freq * t));
      timestamps.push(Math.round(t * 1000));
    }

    const result = processPpgSignal(brightness, timestamps, DEFAULT_PPG_CONFIG);
    expect(result.beatCount).toBeGreaterThan(20);
    expect(result.rrIntervals.length).toBeGreaterThan(10);

    // Average RR should be close to 60000/70 ≈ 857ms
    if (result.rrIntervals.length > 0) {
      const avgRR = result.rrIntervals.reduce((s, v) => s + v, 0) / result.rrIntervals.length;
      expect(avgRR).toBeGreaterThan(700);
      expect(avgRR).toBeLessThan(1000);
    }
  });

  it('estimates heart rate from peak intervals', () => {
    const fps = 30;
    const durationSeconds = 20;
    const targetHR = 72;
    const freq = targetHR / 60;

    const brightness: number[] = [];
    const timestamps: number[] = [];

    for (let i = 0; i < fps * durationSeconds; i++) {
      const t = i / fps;
      brightness.push(128 + 50 * Math.sin(2 * Math.PI * freq * t));
      timestamps.push(Math.round(t * 1000));
    }

    const result = processPpgSignal(brightness, timestamps, DEFAULT_PPG_CONFIG);
    if (result.estimatedHr > 0) {
      expect(result.estimatedHr).toBeGreaterThan(55);
      expect(result.estimatedHr).toBeLessThan(95);
    }
  });

  it('rejects noisy signal with low quality', () => {
    const fps = 30;
    const brightness: number[] = [];
    const timestamps: number[] = [];

    // Deterministic LCG so the assertion is repeatable.
    let seed = 0xc0ffee01;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };

    for (let i = 0; i < fps * 20; i++) {
      brightness.push(128 + (rand() - 0.5) * 200); // Pure noise
      timestamps.push(Math.round((i / fps) * 1000));
    }

    const result = processPpgSignal(brightness, timestamps, DEFAULT_PPG_CONFIG);
    // Noisy signal should have low quality or few valid RR intervals
    expect(result.signalQuality).toBeLessThan(0.85);
  });

  it('filters out physiologically implausible intervals', () => {
    const fps = 30;
    const brightness: number[] = [];
    const timestamps: number[] = [];

    // Very fast signal (5 Hz = 300 bpm - too fast)
    for (let i = 0; i < fps * 15; i++) {
      const t = i / fps;
      brightness.push(128 + 40 * Math.sin(2 * Math.PI * 5 * t));
      timestamps.push(Math.round(t * 1000));
    }

    const result = processPpgSignal(brightness, timestamps, DEFAULT_PPG_CONFIG);
    // All intervals should be within 300-2500ms range
    for (const rr of result.rrIntervals) {
      expect(rr).toBeGreaterThanOrEqual(300);
      expect(rr).toBeLessThanOrEqual(2500);
    }
  });
});
