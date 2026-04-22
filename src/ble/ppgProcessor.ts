/**
 * Camera-based PPG (photoplethysmography) signal processing.
 *
 * This module provides the signal processing pipeline for extracting
 * RR intervals from camera + flash recordings of a fingertip.
 *
 * The actual camera capture requires expo-camera with frame processor,
 * which provides per-frame average pixel brightness. This module
 * processes that brightness signal into usable RR intervals.
 *
 * Pipeline:
 *   1. Collect brightness values from camera frames (~30fps)
 *   2. Apply bandpass filter (0.5–3.5 Hz → 30–210 bpm)
 *   3. Detect peaks in filtered signal
 *   4. Compute inter-beat intervals (IBI) from peak timings
 *   5. Validate IBI against physiological range (300–2500ms)
 *   6. Assess signal quality
 */

export interface PpgConfig {
  /** Camera frame rate (typically 30). */
  fps: number;
  /** Minimum recording duration in seconds. */
  minDurationSeconds: number;
  /** Quality threshold (0–1). Below this, signal is too noisy. */
  qualityThreshold: number;
}

export const DEFAULT_PPG_CONFIG: PpgConfig = {
  fps: 30,
  minDurationSeconds: 60,
  qualityThreshold: 0.6,
};

export interface PpgResult {
  /** Extracted RR intervals in milliseconds. */
  rrIntervals: number[];
  /** Signal quality score 0–1 (1 = perfect). */
  signalQuality: number;
  /** Whether the signal quality is sufficient for HRV computation. */
  isUsable: boolean;
  /** Heart rate estimated from peak intervals. */
  estimatedHr: number;
  /** Number of detected beats. */
  beatCount: number;
}

/**
 * Processes raw brightness values from camera frames into RR intervals.
 *
 * @param brightnessValues Array of frame-by-frame average brightness (0–255)
 * @param timestamps Array of frame timestamps in milliseconds
 * @param config PPG configuration
 * @returns PpgResult with extracted RR intervals, signal quality, and usability flag
 * @example
 * // Generate a synthetic 30-second signal at 70 bpm
 * const fps = 30, duration = 30, bpm = 70;
 * const brightness: number[] = [];
 * const timestamps: number[] = [];
 * for (let i = 0; i < fps * duration; i++) {
 *   const t = i / fps;
 *   brightness.push(128 + 40 * Math.sin(2 * Math.PI * (bpm / 60) * t));
 *   timestamps.push(Math.round(t * 1000));
 * }
 * const result = processPpgSignal(brightness, timestamps);
 * // result.rrIntervals → ~857ms intervals (60000/70)
 * // result.isUsable → true if signalQuality ≥ 0.6
 */
export function processPpgSignal(
  brightnessValues: number[],
  timestamps: number[],
  config: PpgConfig = DEFAULT_PPG_CONFIG
): PpgResult {
  const emptyResult: PpgResult = {
    rrIntervals: [],
    signalQuality: 0,
    isUsable: false,
    estimatedHr: 0,
    beatCount: 0,
  };

  if (config.fps <= 0) return emptyResult;
  if (brightnessValues.length !== timestamps.length) return emptyResult;
  if (brightnessValues.length < config.fps * 10) return emptyResult;

  // Step 1: Normalize signal to zero mean
  const mean = brightnessValues.reduce((s, v) => s + v, 0) / brightnessValues.length;
  const normalized = brightnessValues.map((v) => v - mean);

  // Step 2: Simple moving average filter (removes high-frequency noise)
  const smoothingWindow = Math.max(2, Math.round(config.fps / 10));
  const smoothed = movingAverage(normalized, smoothingWindow);

  // Step 3: Peak detection using local maxima
  const peaks = detectPeaks(smoothed, config.fps);

  // Step 4: Convert peak indices to RR intervals using timestamps
  const rrIntervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const ibi = timestamps[peaks[i]] - timestamps[peaks[i - 1]];
    // Physiological range: 300–2500ms (24–200 bpm)
    if (ibi >= 300 && ibi <= 2500) {
      rrIntervals.push(Math.round(ibi * 100) / 100);
    }
  }

  // Step 5: Assess signal quality
  const signalQuality = assessSignalQuality(rrIntervals, peaks.length, brightnessValues);

  // Step 6: Compute estimated HR
  const avgRR =
    rrIntervals.length > 0 ? rrIntervals.reduce((s, v) => s + v, 0) / rrIntervals.length : 0;
  const estimatedHr = avgRR > 0 ? 60000 / avgRR : 0;

  return {
    rrIntervals,
    signalQuality,
    isUsable: signalQuality >= config.qualityThreshold && rrIntervals.length >= 30,
    estimatedHr,
    beatCount: peaks.length,
  };
}

function movingAverage(data: number[], windowSize: number): number[] {
  if (windowSize < 2) return [...data];
  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(data.length, i + halfWindow + 1);
    const window = data.slice(start, end);
    result.push(window.reduce((s, v) => s + v, 0) / window.length);
  }

  return result;
}

function detectPeaks(signal: number[], fps: number): number[] {
  const peaks: number[] = [];
  // Minimum distance between peaks: ~300ms → 0.3 * fps frames (min 2)
  const minDistance = Math.max(2, Math.round(0.3 * fps));

  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
      // Check minimum distance from last peak
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
        peaks.push(i);
      }
    }
  }

  return peaks;
}

function assessSignalQuality(
  rrIntervals: number[],
  peakCount: number,
  brightness: number[]
): number {
  if (rrIntervals.length < 5) return 0;

  // Factor 1: RR interval consistency (low std dev relative to mean = good)
  const mean = rrIntervals.reduce((s, v) => s + v, 0) / rrIntervals.length;
  const variance = rrIntervals.reduce((s, v) => s + (v - mean) ** 2, 0) / rrIntervals.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
  const consistencyScore = Math.max(0, 1 - cv * 3); // CV of 0.33 → score 0

  // Factor 2: Signal amplitude (finger on camera should have high brightness variance)
  const brightnessMean = brightness.reduce((s, v) => s + v, 0) / brightness.length;
  const brightnessVar =
    brightness.reduce((s, v) => s + (v - brightnessMean) ** 2, 0) / brightness.length;
  const amplitudeScore = Math.min(1, Math.sqrt(brightnessVar) / 20);

  // Factor 3: Beat regularity (ratio of valid to total peaks)
  const validRatio = peakCount > 0 ? rrIntervals.length / (peakCount - 1) : 0;

  return Math.round((consistencyScore * 0.4 + amplitudeScore * 0.3 + validRatio * 0.3) * 100) / 100;
}
