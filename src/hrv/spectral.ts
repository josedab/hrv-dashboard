/**
 * Frequency-domain HRV spectral analysis.
 *
 * Computes power in the standard frequency bands (VLF, LF, HF) from
 * RR intervals using the Goertzel algorithm (reused from the coherence
 * module). This avoids an FFT dependency while providing clinically
 * relevant spectral metrics.
 *
 * Band definitions (Task Force of ESC/NASPE, 1996):
 *   VLF: 0.003–0.04 Hz  (thermoregulation, RAAS, very slow)
 *   LF:  0.04–0.15 Hz   (mix of sympathetic + parasympathetic)
 *   HF:  0.15–0.40 Hz   (parasympathetic / vagal tone)
 *
 * Note: VLF requires ≥ 5 minutes of data to be meaningful.
 */
import { goertzelPower, resampleRrToFixedHz, RESAMPLE_HZ } from '../biofeedback/coherence';

/** Standard frequency band boundaries in Hz. */
export const BANDS = {
  vlf: { lo: 0.003, hi: 0.04, label: 'VLF' },
  lf: { lo: 0.04, hi: 0.15, label: 'LF' },
  hf: { lo: 0.15, hi: 0.4, label: 'HF' },
} as const;

/** Frequency step for the Goertzel scan (Hz). Smaller = finer resolution. */
const FREQ_STEP = 0.005;

/** Minimum RR intervals needed for meaningful spectral analysis. */
export const MIN_RR_FOR_SPECTRAL = 60;

/** Minimum recording duration (seconds) for reliable VLF estimation. */
const MIN_SECONDS_FOR_VLF = 120;

export interface BandPower {
  /** Absolute power in ms²/Hz (relative units from Goertzel). */
  absolute: number;
  /** Percentage of total power (VLF + LF + HF). */
  percent: number;
  /** Peak frequency within the band (Hz), or null if no power. */
  peakHz: number | null;
}

export interface SpectralResult {
  vlf: BandPower;
  lf: BandPower;
  hf: BandPower;
  /** LF / HF power ratio — marker of sympathovagal balance. */
  lfHfRatio: number;
  /** Total power across all three bands. */
  totalPower: number;
  /** Whether VLF data is considered reliable (recording ≥ 2 min). */
  vlfReliable: boolean;
  /** Number of RR intervals used. */
  sampleCount: number;
}

/** Empty result returned when data is insufficient. */
function emptyResult(sampleCount: number): SpectralResult {
  const zeroBand: BandPower = { absolute: 0, percent: 0, peakHz: null };
  return {
    vlf: { ...zeroBand },
    lf: { ...zeroBand },
    hf: { ...zeroBand },
    lfHfRatio: 0,
    totalPower: 0,
    vlfReliable: false,
    sampleCount,
  };
}

/**
 * Computes frequency-domain HRV metrics from RR intervals (ms).
 *
 * Resamples the RR series to a uniform grid (4 Hz), detrends, then scans
 * VLF/LF/HF bands using the Goertzel algorithm.
 * @returns SpectralResult with band powers, LF/HF ratio, and VLF reliability flag.
 */
export function computeSpectralMetrics(rrIntervals: number[]): SpectralResult {
  if (rrIntervals.length < MIN_RR_FOR_SPECTRAL) {
    return emptyResult(rrIntervals.length);
  }

  const resampled = resampleRrToFixedHz(rrIntervals, RESAMPLE_HZ);
  if (resampled.length < 16) {
    return emptyResult(rrIntervals.length);
  }

  // Detrend: subtract mean
  const mean = resampled.reduce((s, v) => s + v, 0) / resampled.length;
  const centered = resampled.map((v) => v - mean);

  // Estimate recording duration for VLF reliability check
  const totalMs = rrIntervals.reduce((s, v) => s + v, 0);
  const totalSeconds = totalMs / 1000;
  const vlfReliable = totalSeconds >= MIN_SECONDS_FOR_VLF;

  // Scan each band
  const vlf = scanBand(centered, BANDS.vlf.lo, BANDS.vlf.hi);
  const lf = scanBand(centered, BANDS.lf.lo, BANDS.lf.hi);
  const hf = scanBand(centered, BANDS.hf.lo, BANDS.hf.hi);

  const totalPower = vlf.power + lf.power + hf.power;

  const makeBand = (scan: BandScan): BandPower => ({
    absolute: Math.round(scan.power * 100) / 100,
    percent: totalPower > 0 ? Math.round((scan.power / totalPower) * 10000) / 100 : 0,
    peakHz: scan.peakHz,
  });

  const lfHfRatio = hf.power > 0 ? Math.round((lf.power / hf.power) * 100) / 100 : 0;

  return {
    vlf: makeBand(vlf),
    lf: makeBand(lf),
    hf: makeBand(hf),
    lfHfRatio,
    totalPower: Math.round(totalPower * 100) / 100,
    vlfReliable,
    sampleCount: rrIntervals.length,
  };
}

interface BandScan {
  power: number;
  peakHz: number | null;
}

function scanBand(centered: number[], loHz: number, hiHz: number): BandScan {
  let totalPower = 0;
  let peakPower = 0;
  let peakHz: number | null = null;

  for (let f = loHz; f <= hiHz; f += FREQ_STEP) {
    const p = goertzelPower(centered, RESAMPLE_HZ, f);
    totalPower += p;
    if (p > peakPower) {
      peakPower = p;
      peakHz = Math.round(f * 1000) / 1000;
    }
  }

  return { power: totalPower, peakHz: peakPower > 0 ? peakHz : null };
}
