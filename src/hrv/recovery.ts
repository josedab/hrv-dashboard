import { Session, BaselineResult } from '../types';
import { isInsufficientBaseline } from './baseline';

/**
 * Composite recovery score weights.
 *
 * Sum to 1.0. Chosen so HRV (objective) dominates while subjective inputs
 * round out the score; tuned against a small validation set of weeks where
 * the next-day verdict was already known. Adjust as a unit, not piecemeal,
 * if the model is re-tuned.
 */
const RECOVERY_WEIGHTS = {
  hrv: 0.4,
  sleep: 0.25,
  stress: 0.2,
  readiness: 0.15,
} as const;

/** rMSSD/baseline ratio above this is treated as "already optimal". */
const HRV_RATIO_CAP = 1.2;
/** Subjective scales (1–5) range. */
const SUBJECTIVE_MIN = 1;
const SUBJECTIVE_MAX = 5;
const SUBJECTIVE_RANGE = SUBJECTIVE_MAX - SUBJECTIVE_MIN;
/** Default 0–100 score when a subjective input is missing. */
const NEUTRAL_SUBJECTIVE_SCORE = 50;
/** Minimum days of baseline data required to compute a recovery score. */
const MIN_BASELINE_DAYS_FOR_RECOVERY = 5;

/** 0–100 thresholds that map to the qualitative recovery label. */
const RECOVERY_LABEL_THRESHOLDS = {
  excellent: 80,
  good: 60,
  fair: 40,
} as const;

/** Per-training-type baseline RPE intensity (1–10 RPE-like scale). */
const TRAINING_INTENSITY: Record<string, number> = {
  Strength: 7,
  BJJ: 8,
  Cycling: 6,
  Rest: 1,
  Other: 5,
};
/** Used when an unknown training type is encountered. */
const DEFAULT_TRAINING_INTENSITY = 5;
/** Effort multiplier range bounds, scaled by perceived readiness 1–5. */
const EFFORT_BASELINE = 0.6;
const EFFORT_RANGE = 0.8;

/**
 * Composite recovery score combining HRV, sleep, stress, and subjective readiness.
 */
export interface RecoveryScore {
  /** Overall recovery score 0–100. */
  score: number;
  /** Human-readable label. */
  label: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  /** Individual component scores (0–100 each). */
  components: {
    hrv: number;
    sleep: number;
    stress: number;
    readiness: number;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function subjectiveToScore(rating: number | null): number {
  if (rating === null) return NEUTRAL_SUBJECTIVE_SCORE;
  return Math.round(((rating - SUBJECTIVE_MIN) / SUBJECTIVE_RANGE) * 100);
}

/**
 * Computes a composite recovery score from the latest session and baseline.
 *
 * Weights (research-informed) defined in {@link RECOVERY_WEIGHTS}.
 * @returns RecoveryScore (0–100 with label), or null if baseline is unavailable.
 */
export function computeRecoveryScore(
  session: Session,
  baseline: BaselineResult
): RecoveryScore | null {
  if (isInsufficientBaseline(baseline) || baseline.dayCount < MIN_BASELINE_DAYS_FOR_RECOVERY) {
    return null;
  }

  // HRV component: ratio of current rMSSD to baseline, capped at HRV_RATIO_CAP
  const ratio = Math.min(session.rmssd / baseline.median, HRV_RATIO_CAP);
  const hrvScore = Math.round(Math.min(ratio / HRV_RATIO_CAP, 1) * 100);

  const sleepScore = subjectiveToScore(session.sleepQuality);
  // Stress is inverted: 5 (high stress) → 0, 1 (low) → 100.
  const stressScore =
    session.stressLevel !== null
      ? Math.round(((SUBJECTIVE_MAX - session.stressLevel) / SUBJECTIVE_RANGE) * 100)
      : NEUTRAL_SUBJECTIVE_SCORE;
  const readinessScore = subjectiveToScore(session.perceivedReadiness);

  const score = Math.round(
    hrvScore * RECOVERY_WEIGHTS.hrv +
      sleepScore * RECOVERY_WEIGHTS.sleep +
      stressScore * RECOVERY_WEIGHTS.stress +
      readinessScore * RECOVERY_WEIGHTS.readiness
  );

  const clampedScore = clamp(score, 0, 100);

  return {
    score: clampedScore,
    label:
      clampedScore >= RECOVERY_LABEL_THRESHOLDS.excellent
        ? 'Excellent'
        : clampedScore >= RECOVERY_LABEL_THRESHOLDS.good
          ? 'Good'
          : clampedScore >= RECOVERY_LABEL_THRESHOLDS.fair
            ? 'Fair'
            : 'Poor',
    components: {
      hrv: hrvScore,
      sleep: sleepScore,
      stress: stressScore,
      readiness: readinessScore,
    },
  };
}

/**
 * Estimates daily training load from subjective data.
 * @returns Estimated load value (0 for rest days, higher for intense sessions).
 * Uses a simplified RPE-based model (training type intensity × perceived effort).
 */
export function estimateTrainingLoad(session: Session): number {
  if (!session.trainingType) return 0;

  const baseIntensity = TRAINING_INTENSITY[session.trainingType] ?? DEFAULT_TRAINING_INTENSITY;

  // Scale by perceived readiness (higher readiness → likely pushed harder)
  const effortMultiplier =
    session.perceivedReadiness !== null
      ? EFFORT_BASELINE + (session.perceivedReadiness / SUBJECTIVE_MAX) * EFFORT_RANGE
      : 1.0;

  return Math.round(baseIntensity * effortMultiplier * 10);
}

/**
 * Computes a 7-day rolling training load sum.
 * @returns Sum of daily training loads across all sessions.
 */
export function computeWeeklyLoad(sessions: Session[]): number {
  return sessions.reduce((total, s) => total + estimateTrainingLoad(s), 0);
}
