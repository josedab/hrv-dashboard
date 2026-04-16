import { Session, BaselineResult } from '../types';

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

/**
 * Computes a composite recovery score from the latest session and baseline.
 *
 * Weights (research-informed):
 *   HRV ratio:           40%
 *   Sleep quality:        25%
 *   Stress (inverse):     20%
 *   Perceived readiness:  15%
 *
 * Returns null if baseline is unavailable.
 */
export function computeRecoveryScore(
  session: Session,
  baseline: BaselineResult
): RecoveryScore | null {
  if (baseline.median === 0 || baseline.dayCount < 5) return null;

  // HRV component: ratio of current rMSSD to baseline, capped at 120%
  const ratio = Math.min(session.rmssd / baseline.median, 1.2);
  const hrvScore = Math.round(Math.min(ratio / 1.2, 1) * 100);

  // Sleep component: sleep quality 1-5 mapped to 0-100
  const sleepScore = session.sleepQuality !== null
    ? Math.round(((session.sleepQuality - 1) / 4) * 100)
    : 50; // neutral if not logged

  // Stress component: inverted (5=high stress → low score)
  const stressScore = session.stressLevel !== null
    ? Math.round(((5 - session.stressLevel) / 4) * 100)
    : 50;

  // Readiness component: perceived readiness 1-5 mapped to 0-100
  const readinessScore = session.perceivedReadiness !== null
    ? Math.round(((session.perceivedReadiness - 1) / 4) * 100)
    : 50;

  const score = Math.round(
    hrvScore * 0.40 +
    sleepScore * 0.25 +
    stressScore * 0.20 +
    readinessScore * 0.15
  );

  const clampedScore = Math.max(0, Math.min(100, score));

  return {
    score: clampedScore,
    label: clampedScore >= 80 ? 'Excellent' :
           clampedScore >= 60 ? 'Good' :
           clampedScore >= 40 ? 'Fair' : 'Poor',
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
 * Uses a simplified RPE-based model (training type intensity × perceived effort).
 */
export function estimateTrainingLoad(session: Session): number {
  if (!session.trainingType) return 0;

  const intensityMap: Record<string, number> = {
    'Strength': 7,
    'BJJ': 8,
    'Cycling': 6,
    'Rest': 1,
    'Other': 5,
  };

  const baseIntensity = intensityMap[session.trainingType] ?? 5;

  // Scale by perceived readiness (higher readiness → likely pushed harder)
  const effortMultiplier = session.perceivedReadiness !== null
    ? 0.6 + (session.perceivedReadiness / 5) * 0.8
    : 1.0;

  return Math.round(baseIntensity * effortMultiplier * 10);
}

/**
 * Computes a 7-day rolling training load sum.
 */
export function computeWeeklyLoad(sessions: Session[]): number {
  return sessions.reduce((total, s) => total + estimateTrainingLoad(s), 0);
}
