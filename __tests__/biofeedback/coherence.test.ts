import {
  computeCoherence,
  resampleRrToFixedHz,
  goertzelPower,
  computePacerState,
  RESONANCE_PACER,
  MIN_SAMPLES_FOR_COHERENCE,
} from '../../src/biofeedback/coherence';

describe('resampleRrToFixedHz', () => {
  it('returns empty for fewer than 2 RR intervals', () => {
    expect(resampleRrToFixedHz([], 4)).toEqual([]);
    expect(resampleRrToFixedHz([1000], 4)).toEqual([]);
  });

  it('returns IHR samples at the requested rate', () => {
    const rr = Array(60).fill(1000); // 60s flat → ~60bpm
    const out = resampleRrToFixedHz(rr, 4);
    expect(out.length).toBeGreaterThan(200);
    // All HR should be ~60 bpm
    out.forEach((v) => expect(v).toBeCloseTo(60, 0));
  });
});

describe('goertzelPower', () => {
  it('finds power at the injected frequency', () => {
    const fs = 4;
    const f = 0.1;
    const N = 256;
    const samples = Array.from({ length: N }, (_, i) =>
      Math.sin((2 * Math.PI * f * i) / fs)
    );
    const onTarget = goertzelPower(samples, fs, 0.1);
    const offTarget = goertzelPower(samples, fs, 0.3);
    expect(onTarget).toBeGreaterThan(offTarget * 5);
  });
});

describe('computeCoherence', () => {
  it('returns score 0 with too few samples', () => {
    const result = computeCoherence(Array(10).fill(1000));
    expect(result.score).toBe(0);
    expect(result.peakFrequencyHz).toBeNull();
  });

  it('computes a score for a long flat signal (low coherence)', () => {
    const result = computeCoherence(Array(MIN_SAMPLES_FOR_COHERENCE + 50).fill(1000));
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('produces a higher score for a clean ~6 bpm respiratory sinus arrhythmia signal', () => {
    // Simulate RR series oscillating at 0.1 Hz (10s period = 6 brpm)
    // RR intervals oscillate between ~800 and ~1000ms
    const rr: number[] = [];
    let t = 0;
    for (let i = 0; i < 300; i++) {
      const rrMs = 900 + 100 * Math.sin(2 * Math.PI * 0.1 * t);
      rr.push(rrMs);
      t += rrMs / 1000;
    }
    const noisy = computeCoherence(Array(300).fill(900).map((v) => v + (Math.random() - 0.5) * 5));
    const coherent = computeCoherence(rr);
    expect(coherent.score).toBeGreaterThan(noisy.score);
  });
});

describe('computePacerState', () => {
  it('starts in inhale at t=0', () => {
    const state = computePacerState(0, RESONANCE_PACER);
    expect(state.phase).toBe('inhale');
    expect(state.scale).toBe(0);
    expect(state.cycleCount).toBe(0);
  });

  it('reaches full scale at end of inhale', () => {
    const state = computePacerState(5, RESONANCE_PACER);
    expect(state.phase).toBe('exhale');
    expect(state.cycleCount).toBe(0);
  });

  it('completes a cycle after inhale + exhale', () => {
    const state = computePacerState(10, RESONANCE_PACER);
    expect(state.cycleCount).toBe(1);
    expect(state.phase).toBe('inhale');
  });

  it('handles config with hold phase', () => {
    const config = { inhaleSeconds: 4, exhaleSeconds: 4, holdSeconds: 2 };
    const cycle = 4 + 2 + 4 + 2;
    const state = computePacerState(5, config);
    expect(state.phase).toBe('hold-top');
    expect(state.cycleCount).toBe(0);

    const after = computePacerState(cycle, config);
    expect(after.cycleCount).toBe(1);
  });

  it('returns zero-state for zero cycle', () => {
    const state = computePacerState(5, { inhaleSeconds: 0, exhaleSeconds: 0 });
    expect(state.cycleCount).toBe(0);
  });
});
