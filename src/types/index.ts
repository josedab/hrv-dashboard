/** Readiness verdict determined by comparing current rMSSD to baseline. */
export type VerdictType = 'go_hard' | 'moderate' | 'rest';

/**
 * A complete HRV recording session with objective metrics and optional
 * subjective log data (perceived readiness, training type, notes).
 */
export interface Session {
  /** UUID v4 identifier. */
  id: string;
  /** Recording start time in ISO 8601 UTC. */
  timestamp: string;
  /** Recording duration in seconds (typically 120–300). */
  durationSeconds: number;
  /** Raw RR intervals in milliseconds, as received from the BLE sensor. */
  rrIntervals: number[];
  /** Root Mean Square of Successive Differences (ms). Primary readiness metric. */
  rmssd: number;
  /** Standard Deviation of NN intervals (ms). Population std dev (÷N). */
  sdnn: number;
  /** Average heart rate in beats per minute. */
  meanHr: number;
  /** Percentage (0–100) of successive RR intervals differing by >50 ms. */
  pnn50: number;
  /** Fraction (0–1) of RR intervals flagged as artifacts. */
  artifactRate: number;
  /** Readiness verdict, or `null` if insufficient baseline data (<5 days). */
  verdict: VerdictType | null;
  /** Subjective perceived readiness (1–5), set via LogScreen. */
  perceivedReadiness: number | null;
  /** Training type selected by the user after recording. */
  trainingType: string | null;
  /** Free-text notes entered by the user after recording. */
  notes: string | null;
}

/**
 * Computed HRV metrics returned by {@link computeHrvMetrics}.
 * All values are zero when fewer than 2 clean RR intervals are available.
 */
export interface HrvMetrics {
  rmssd: number;
  sdnn: number;
  meanHr: number;
  pnn50: number;
  artifactRate: number;
}

/**
 * Result of rolling baseline computation.
 * Used by {@link computeVerdict} to determine readiness.
 */
export interface BaselineResult {
  /** Median rMSSD over the baseline window. */
  median: number;
  /** Number of days with at least one reading. */
  dayCount: number;
  /** Individual daily rMSSD values used in the computation. */
  values: number[];
}

/**
 * User-configurable settings persisted in the `settings` table.
 * Missing values fall back to {@link DEFAULT_SETTINGS}.
 */
export interface Settings {
  /** Rolling baseline window in days (5, 7, 10, or 14). */
  baselineWindowDays: number;
  /** Ratio threshold for "Go Hard" verdict (default 0.95). */
  goHardThreshold: number;
  /** Ratio threshold for "Moderate" verdict (default 0.80). */
  moderateThreshold: number;
  /** BLE device ID of the paired heart rate monitor. */
  pairedDeviceId: string | null;
  /** Display name of the paired heart rate monitor. */
  pairedDeviceName: string | null;
}

/** Default settings used when no user overrides are stored. */
export const DEFAULT_SETTINGS: Settings = {
  baselineWindowDays: 7,
  goHardThreshold: 0.95,
  moderateThreshold: 0.80,
  pairedDeviceId: null,
  pairedDeviceName: null,
};

/**
 * One rMSSD reading per day, used for baseline computation.
 * Retrieved by {@link getDailyReadings} using the first session of each day.
 */
export interface DailyReading {
  /** Date in YYYY-MM-DD format. */
  date: string;
  /** rMSSD value from the first session of the day. */
  rmssd: number;
  /** Verdict from the first session of the day. */
  verdict: VerdictType | null;
}
