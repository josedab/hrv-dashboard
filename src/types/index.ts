/** Readiness verdict determined by comparing current rMSSD to baseline. */
export type VerdictType = 'go_hard' | 'moderate' | 'rest';

const VERDICT_VALUES: ReadonlySet<string> = new Set<VerdictType>(['go_hard', 'moderate', 'rest']);

/**
 * Validates and narrows an unknown value to a {@link VerdictType} or null.
 *
 * Used when reading verdicts from external sources (DB rows, backups, sync
 * payloads) so that any corruption or schema drift surfaces as `null`
 * (= "no verdict") rather than propagating an invalid string.
 */
export function parseVerdict(value: unknown): VerdictType | null {
  return typeof value === 'string' && VERDICT_VALUES.has(value) ? (value as VerdictType) : null;
}

/** How a session's RR intervals were collected. */
export type SessionSource = 'chest_strap' | 'camera';

const SESSION_SOURCE_VALUES: ReadonlySet<string> = new Set<SessionSource>([
  'chest_strap',
  'camera',
]);

/** Validates an unknown value as {@link SessionSource}; defaults to 'chest_strap'. */
export function parseSessionSource(value: unknown): SessionSource {
  return typeof value === 'string' && SESSION_SOURCE_VALUES.has(value)
    ? (value as SessionSource)
    : 'chest_strap';
}

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
  /** Hours of sleep the night before (optional, 0–24). */
  sleepHours: number | null;
  /** Subjective sleep quality (1–5), set via LogScreen. */
  sleepQuality: number | null;
  /** Subjective stress level (1–5), set via LogScreen. */
  stressLevel: number | null;
  /** How RR intervals were collected. Camera sessions are excluded from baseline. */
  source: SessionSource;
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
 * Verdict computation mode.
 *
 * - `fixed`: ratio thresholds (currentRmssd / baselineMedian) using
 *   {@link Settings.goHardThreshold} and {@link Settings.moderateThreshold}.
 *   Predictable and identical for every user.
 * - `adaptive`: personal percentile cutoffs derived from the user's own
 *   rolling rMSSD distribution (with a Bayesian nudge from perceived-
 *   readiness labels when available). Falls back to fixed thresholds
 *   during cold start (< 30 days of history).
 */
export type VerdictMode = 'fixed' | 'adaptive';

const VERDICT_MODE_VALUES: ReadonlySet<string> = new Set<VerdictMode>(['fixed', 'adaptive']);

/** Validates an unknown value as {@link VerdictMode}; defaults to 'fixed'. */
export function parseVerdictMode(value: unknown): VerdictMode {
  return typeof value === 'string' && VERDICT_MODE_VALUES.has(value)
    ? (value as VerdictMode)
    : 'fixed';
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
  /** Whether to show the guided breathing exercise before each recording. */
  breathingExerciseEnabled: boolean;
  /** Whether to use fixed ratio cutoffs or personal percentile cutoffs. */
  verdictMode: VerdictMode;
}

/** Default settings used when no user overrides are stored. */
export const DEFAULT_SETTINGS: Settings = {
  baselineWindowDays: 7,
  goHardThreshold: 0.95,
  moderateThreshold: 0.8,
  pairedDeviceId: null,
  pairedDeviceName: null,
  breathingExerciseEnabled: true,
  verdictMode: 'fixed',
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

/**
 * Patch payload for {@link updateSessionLog}.
 *
 * Only the fields populated by the user-facing log form. All optional —
 * undefined fields are treated as "no change" by the repository. Use
 * `null` to explicitly clear a value.
 */
export interface SessionLogPatch {
  perceivedReadiness?: number | null;
  trainingType?: string | null;
  notes?: string | null;
  sleepHours?: number | null;
  sleepQuality?: number | null;
  stressLevel?: number | null;
}

/**
 * Repository interface for session persistence.
 *
 * Defines the contract that the concrete SQLite implementation fulfils.
 * Hooks and utilities should program against this interface so the
 * persistence layer can be swapped (e.g., for testing or watch/web targets)
 * without changing consumer code.
 *
 * The concrete implementation lives in `database/sessionRepository.ts`.
 */
export interface ISessionRepository {
  saveSession(session: Session): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  getTodaySession(todayDateStr: string): Promise<Session | null>;
  getAllSessions(): Promise<Session[]>;
  getSessionById(id: string): Promise<Session | null>;
  getRecentSessions(days: number): Promise<Session[]>;
  getDailyReadings(windowDays: number): Promise<DailyReading[]>;
  getSessionDates(): Promise<string[]>;
  getSessionCount(): Promise<number>;
  upsertManySessionsIfMissing(sessions: Session[]): Promise<number>;
}

/**
 * Repository interface for user settings persistence.
 *
 * See {@link ISessionRepository} for design rationale. The concrete
 * implementation lives in `database/settingsRepository.ts`.
 */
export interface ISettingsRepository {
  loadSettings(): Promise<Settings>;
  saveSetting(key: keyof Settings, value: string): Promise<void>;
  saveSettings(settings: Partial<Settings>): Promise<void>;
  clearPairedDevice(): Promise<void>;
  getRawSetting(key: string): Promise<string | null>;
  setRawSetting(key: string, value: string): Promise<void>;
  isOnboardingComplete(): Promise<boolean>;
  setOnboardingComplete(): Promise<void>;
}
