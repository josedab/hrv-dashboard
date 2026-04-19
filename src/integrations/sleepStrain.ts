/**
 * Strain fusion + integrated recovery on top of the existing sleep helpers.
 *
 * Note: sleep-only reading (`readLastNightSleep`, `SleepSummary`) was
 * graduated to `src/integrations/healthSleep.ts` once the Log screen
 * began auto-prefilling sleep duration; this module re-exports those
 * symbols for back-compat with existing tests/consumers and continues
 * to own the strain helpers.
 */
import { Platform } from 'react-native';
import { Session, BaselineResult } from '../types';
import { computeRecoveryScore, RecoveryScore } from '../hrv/recovery';
import {
  readLastNightSleep,
  summarizeSleep,
  _resetHealthModuleCache as _resetSleepCache,
  SleepSummary,
} from './healthSleep';
import { getHealthSdk, _resetHealthSdkCache } from './healthSdk';

export { readLastNightSleep, summarizeSleep, SleepSummary };

/** Test-only reset hook covering both this module and the graduated sleep helpers. */
export function _resetHealthModuleCache(): void {
  _resetHealthSdkCache();
  _resetSleepCache();
}

export interface StrainSummary {
  /** 0–100, derived from last 24h workout intensity × duration. */
  score: number;
  /** Total active calories logged in the last 24h. */
  activeKcal: number;
  /** Number of workouts counted. */
  workoutCount: number;
}

/** Reads recent workout strain from the platform health store. */
export async function readRecentStrain(now: Date = new Date()): Promise<StrainSummary | null> {
  const health = getHealthSdk();
  if (!health) return null;

  const end = now;
  const start = new Date(end.getTime() - 24 * 3600_000);

  try {
    if (Platform.OS === 'ios') {
      const workouts: WorkoutRecord[] = await new Promise((resolve, reject) => {
        health.getSamples?.(
          {
            type: 'Workout',
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          },
          (err: Error | null, data: WorkoutRecord[] | null) =>
            err ? reject(err) : resolve(data ?? [])
        );
      });
      return summarizeStrain(workouts);
    }

    if (Platform.OS === 'android') {
      const records = await health.readRecords?.('ExerciseSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });
      const workouts: WorkoutRecord[] = (records?.records ?? []).map(
        (r: {
          startTime: string;
          endTime: string;
          activeKilocalories?: { inKilocalories: number };
        }) => ({
          startDate: r.startTime,
          endDate: r.endTime,
          calories: r.activeKilocalories?.inKilocalories ?? 0,
        })
      );
      return summarizeStrain(workouts);
    }
  } catch (err) {
    console.warn('[sleepStrain] readRecentStrain failed:', err);
  }
  return null;
}

interface WorkoutRecord {
  startDate: string;
  endDate: string;
  calories?: number;
}

function summarizeStrain(workouts: WorkoutRecord[]): StrainSummary | null {
  if (workouts.length === 0) return { score: 0, activeKcal: 0, workoutCount: 0 };

  let totalKcal = 0;
  let weightedMinutes = 0;

  for (const w of workouts) {
    const start = Date.parse(w.startDate);
    const end = Date.parse(w.endDate);
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) continue;
    const minutes = (end - start) / 60_000;
    const kcal = w.calories ?? 0;
    totalKcal += kcal;
    const intensity = kcal > 0 ? kcal / minutes : 5;
    weightedMinutes += minutes * Math.min(intensity / 10, 1.5);
  }

  const score = Math.min(100, Math.round(weightedMinutes * 1.2));
  return {
    score,
    activeKcal: Math.round(totalKcal),
    workoutCount: workouts.length,
  };
}

/**
 * Augments a session with sleep + strain inputs from the health store
 * (or the user's manual log if health data isn't available). Returns a
 * shallow copy with non-null fields filled in.
 */
export function applyHealthInputs(
  session: Session,
  sleep: SleepSummary | null,
  strain: StrainSummary | null
): Session {
  const next: Session = { ...session };
  if (sleep) {
    if (next.sleepHours === null) next.sleepHours = sleep.hoursTotal;
    if (next.sleepQuality === null && sleep.qualityEstimate !== null) {
      next.sleepQuality = sleep.qualityEstimate;
    }
  }
  void strain;
  return next;
}

/**
 * Recovery score using the rules-based formula but biasing the HRV score
 * down when recent strain is very high (since rMSSD will lag).
 */
export function computeIntegratedRecovery(
  session: Session,
  baseline: BaselineResult,
  strain: StrainSummary | null
): RecoveryScore | null {
  const base = computeRecoveryScore(session, baseline);
  if (!base) return null;
  if (!strain || strain.score < 70) return base;

  const penalty = Math.min(10, Math.round((strain.score - 70) / 3));
  const penalized = Math.max(0, Math.min(100, base.score - penalty));
  return {
    ...base,
    score: penalized,
    label:
      penalized >= 80 ? 'Excellent' : penalized >= 60 ? 'Good' : penalized >= 40 ? 'Fair' : 'Poor',
  };
}
