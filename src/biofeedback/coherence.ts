/**
 * Real-time HRV biofeedback / coherence trainer.
 *
 * Streams RR intervals from the BLE recording into a sliding window and
 * computes a "coherence" score that reflects how rhythmic and synchronous
 * the user's heart-rate oscillations are with their breathing. Used by
 * the in-app breathing trainer to gamify rest-day sessions.
 *
 * Coherence definition (HeartMath-inspired, simplified for on-device use):
 *   Power-spectrum peak ratio in the 0.04–0.26 Hz LF/HF band.
 *
 * We avoid an FFT dependency by using a Goertzel-style discrete frequency
 * scan over the resampled RR series (typically 4 Hz). The output 0–100
 * score maps directly to a "coherence ring" UI similar to commercial
 * biofeedback tools.
 */

export interface CoherenceResult {
  /** 0–100. Higher = more coherent (rhythmic respiratory sinus arrhythmia). */
  score: number;
  /** Dominant peak frequency in Hz, or null if signal is too short. */
  peakFrequencyHz: number | null;
  /** Power at the peak frequency (relative units). */
  peakPower: number;
  /** Number of RR intervals used in the calculation. */
  sampleCount: number;
}

export const MIN_SAMPLES_FOR_COHERENCE = 60; // ~1 minute @ 60 bpm
export const RESAMPLE_HZ = 4;

/**
 * Computes a coherence score for the given window of RR intervals (ms).
 * Returns score 0 with peakPower 0 if too few samples.
 */
export function computeCoherence(rrIntervals: number[]): CoherenceResult {
  if (rrIntervals.length < MIN_SAMPLES_FOR_COHERENCE) {
    return { score: 0, peakFrequencyHz: null, peakPower: 0, sampleCount: rrIntervals.length };
  }

  const resampled = resampleRrToFixedHz(rrIntervals, RESAMPLE_HZ);
  if (resampled.length < 16) {
    return { score: 0, peakFrequencyHz: null, peakPower: 0, sampleCount: rrIntervals.length };
  }

  // Detrend (subtract mean) — Goertzel is sensitive to DC offset
  const mean = resampled.reduce((s, v) => s + v, 0) / resampled.length;
  const centered = resampled.map((v) => v - mean);

  // Scan LF (0.04–0.15 Hz) and HF (0.15–0.4 Hz) bands. Coherence peaks
  // in the resonance band ~0.10 Hz when the user breathes ~6 breaths/min.
  let peakPower = 0;
  let peakFreq = 0;
  let totalPower = 0;
  for (let f = 0.04; f <= 0.4; f += 0.005) {
    const p = goertzelPower(centered, RESAMPLE_HZ, f);
    totalPower += p;
    if (p > peakPower) {
      peakPower = p;
      peakFreq = f;
    }
  }

  if (totalPower === 0) {
    return { score: 0, peakFrequencyHz: null, peakPower: 0, sampleCount: rrIntervals.length };
  }

  // Coherence score: peak prominence × resonance proximity
  const peakRatio = peakPower / totalPower;
  const resonanceBonus =
    peakFreq >= 0.08 && peakFreq <= 0.13 ? 1 : Math.max(0, 1 - Math.abs(peakFreq - 0.1) * 5);

  const score = Math.max(0, Math.min(100, Math.round(peakRatio * resonanceBonus * 1000)));

  return {
    score,
    peakFrequencyHz: peakFreq,
    peakPower,
    sampleCount: rrIntervals.length,
  };
}

/**
 * Resamples a non-uniformly sampled RR series (event-based) to a uniform
 * grid at `hz` samples/sec via linear interpolation. Returns the
 * resampled instantaneous heart-rate series in bpm.
 */
export function resampleRrToFixedHz(rrIntervals: number[], hz: number): number[] {
  if (rrIntervals.length < 2) return [];

  // Build cumulative time stamps, skipping non-positive RR values
  const times: number[] = [];
  const validRr: number[] = [];
  let t = 0;
  for (const rr of rrIntervals) {
    if (!Number.isFinite(rr) || rr <= 0) continue;
    t += rr / 1000;
    times.push(t);
    validRr.push(rr);
  }
  if (validRr.length < 2) return [];

  const totalSeconds = times[times.length - 1];
  const sampleCount = Math.floor(totalSeconds * hz);
  if (sampleCount < 2) return [];

  const ihr = validRr.map((rr) => 60000 / rr);
  const out: number[] = new Array(sampleCount);

  let idx = 0;
  for (let i = 0; i < sampleCount; i++) {
    const targetT = i / hz;
    while (idx < times.length - 1 && times[idx + 1] < targetT) idx++;
    if (idx >= times.length - 1) {
      out[i] = ihr[ihr.length - 1];
      continue;
    }
    const t0 = times[idx];
    const t1 = times[idx + 1];
    const span = t1 - t0;
    const alpha = span > 0 ? (targetT - t0) / span : 0;
    out[i] = ihr[idx] + (ihr[idx + 1] - ihr[idx]) * alpha;
  }
  return out;
}

/** Goertzel algorithm: power at one specific frequency. */
export function goertzelPower(samples: number[], sampleRateHz: number, freqHz: number): number {
  const N = samples.length;
  const k = (freqHz * N) / sampleRateHz;
  const omega = (2 * Math.PI * k) / N;
  const cosw = Math.cos(omega);
  const coeff = 2 * cosw;

  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < N; i++) {
    s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  // Power = s1^2 + s2^2 - coeff*s1*s2
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

/**
 * Breathing pacer state machine. Drives the on-screen guide ring that
 * inhale/exhale pulses to a target respiratory rate (default 6 brpm,
 * 5s in / 5s out — the classical resonance frequency).
 */
export interface PacerConfig {
  inhaleSeconds: number;
  exhaleSeconds: number;
  /** Optional hold at top/bottom of breath. */
  holdSeconds?: number;
}

export const RESONANCE_PACER: PacerConfig = { inhaleSeconds: 5, exhaleSeconds: 5 };

export type PacerPhase = 'inhale' | 'hold-top' | 'exhale' | 'hold-bottom';

export interface PacerState {
  phase: PacerPhase;
  /** 0–1 progress through current phase. */
  progress: number;
  /** 0–1 ring scale derived from phase (for UI). */
  scale: number;
  /** Whole cycles completed so far. */
  cycleCount: number;
}

/** Pure function: given elapsed seconds, returns the pacer state. */
export function computePacerState(elapsedSeconds: number, config: PacerConfig): PacerState {
  const hold = config.holdSeconds ?? 0;
  const cycle = config.inhaleSeconds + hold + config.exhaleSeconds + hold;
  if (cycle <= 0) {
    return { phase: 'inhale', progress: 0, scale: 0, cycleCount: 0 };
  }
  const cycleCount = Math.floor(elapsedSeconds / cycle);
  const cycleT = elapsedSeconds % cycle;

  if (cycleT < config.inhaleSeconds) {
    const progress = cycleT / config.inhaleSeconds;
    return { phase: 'inhale', progress, scale: progress, cycleCount };
  }
  if (cycleT < config.inhaleSeconds + hold) {
    const progress = (cycleT - config.inhaleSeconds) / Math.max(hold, 1e-6);
    return { phase: 'hold-top', progress, scale: 1, cycleCount };
  }
  if (cycleT < config.inhaleSeconds + hold + config.exhaleSeconds) {
    const progress = (cycleT - config.inhaleSeconds - hold) / config.exhaleSeconds;
    return { phase: 'exhale', progress, scale: 1 - progress, cycleCount };
  }
  const progress =
    (cycleT - config.inhaleSeconds - hold - config.exhaleSeconds) / Math.max(hold, 1e-6);
  return { phase: 'hold-bottom', progress, scale: 0, cycleCount };
}
