/**
 * Sleep + strain inputs integrated into the recovery score.
 *
 * This module provides the read-side counterpart to {@link ../utils/healthSync}.
 * It pulls last-night sleep duration / quality and recent workout strain from
 * Apple HealthKit / Android Health Connect (when the SDKs are installed) and
 * exposes them via a typed interface that the recovery + verdict pipelines
 * consume.
 *
 * If the native SDK is not installed (or permissions denied), every reader
 * returns null and the pipeline gracefully falls back to the user's manual
 * subjective inputs.
 */
import { Platform } from 'react-native';
import { Session, BaselineResult } from '../types';
import { computeRecoveryScore, RecoveryScore } from '../hrv/recovery';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Health SDK types vary by platform
let _healthModule: Record<string, any> | null = null;
let _moduleChecked = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHealthModule(): Record<string, any> | null {
  if (_moduleChecked) return _healthModule;
  _moduleChecked = true;
  try {
    if (Platform.OS === 'ios') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      _healthModule = require('react-native-health');
    } else if (Platform.OS === 'android') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      _healthModule = require('react-native-health-connect');
    }
  } catch {
    _healthModule = null;
  }
  return _healthModule;
}

/** Test-only reset hook. */
export function _resetHealthModuleCache(): void {
  _healthModule = null;
  _moduleChecked = false;
}

/** Last-night sleep summary. */
export interface SleepSummary {
  hoursTotal: number;
  /** 1–5 quality estimate derived from deep + REM share, when available. */
  qualityEstimate: number | null;
  /** ISO 8601 of bedtime start. */
  startedAt: string;
  /** ISO 8601 of wake time. */
  endedAt: string;
}

export interface StrainSummary {
  /** 0–100, derived from last 24h workout intensity × duration. */
  score: number;
  /** Total active calories logged in the last 24h. */
  activeKcal: number;
  /** Number of workouts counted. */
  workoutCount: number;
}

/** Reads last-night sleep from the platform health store. */
export async function readLastNightSleep(now: Date = new Date()): Promise<SleepSummary | null> {
  const health = getHealthModule();
  if (!health) return null;

  const end = now;
  const start = new Date(end.getTime() - 18 * 3600_000); // 6pm yesterday → 12pm today

  try {
    if (Platform.OS === 'ios') {
      const samples: SleepRecord[] = await new Promise((resolve, reject) => {
        health.getSleepSamples?.(
          { startDate: start.toISOString(), endDate: end.toISOString() },
          (err: Error | null, data: SleepRecord[] | null) =>
            err ? reject(err) : resolve(data ?? [])
        );
      });
      return summarizeSleep(samples);
    }

    if (Platform.OS === 'android') {
      const records = await health.readRecords?.('SleepSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });
      if (!records?.records?.length) return null;
      return summarizeSleep(
        records.records.flatMap((r: { stages?: SleepStage[]; startTime: string; endTime: string }) =>
          (r.stages ?? []).map((stage) => ({
            value: mapStageValue(stage.stage),
            startDate: stage.startTime,
            endDate: stage.endTime,
          }))
        )
      );
    }
  } catch (err) {
    console.warn('[sleepStrain] readLastNightSleep failed:', err);
  }
  return null;
}

interface SleepRecord {
  value: string;
  startDate: string;
  endDate: string;
}

interface SleepStage {
  stage: string;
  startTime: string;
  endTime: string;
}

function mapStageValue(stage: string): string {
  switch (stage) {
    case 'DEEP':
      return 'DEEP';
    case 'REM':
      return 'REM';
    case 'LIGHT':
      return 'CORE';
    case 'AWAKE':
      return 'AWAKE';
    default:
      return 'INBED';
  }
}

function summarizeSleep(samples: SleepRecord[]): SleepSummary | null {
  if (samples.length === 0) return null;

  const asleep = samples.filter((s) => s.value !== 'INBED' && s.value !== 'AWAKE');
  if (asleep.length === 0) return null;

  let totalMs = 0;
  let deepMs = 0;
  let remMs = 0;
  let earliest = Infinity;
  let latest = -Infinity;

  for (const s of asleep) {
    const start = Date.parse(s.startDate);
    const end = Date.parse(s.endDate);
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) continue;
    const ms = end - start;
    totalMs += ms;
    if (s.value === 'DEEP') deepMs += ms;
    if (s.value === 'REM') remMs += ms;
    if (start < earliest) earliest = start;
    if (end > latest) latest = end;
  }

  if (totalMs === 0) return null;

  const hoursTotal = totalMs / 3_600_000;
  const restorativeShare = (deepMs + remMs) / totalMs;
  const qualityEstimate =
    restorativeShare > 0
      ? Math.max(1, Math.min(5, Math.round(restorativeShare * 10)))
      : null;

  return {
    hoursTotal: Math.round(hoursTotal * 10) / 10,
    qualityEstimate,
    startedAt: new Date(earliest).toISOString(),
    endedAt: new Date(latest).toISOString(),
  };
}

/** Reads recent workout strain from the platform health store. */
export async function readRecentStrain(now: Date = new Date()): Promise<StrainSummary | null> {
  const health = getHealthModule();
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
        (r: { startTime: string; endTime: string; activeKilocalories?: { inKilocalories: number } }) => ({
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
    // Strain weight: kcal/min as a rough intensity proxy
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
 * (or the user's manual log if health data isn't available). Mutates a
 * shallow copy and returns it.
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
  void strain; // strain feeds the recovery score directly via computeIntegratedRecovery
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

  // Penalize composite score by up to 10 pts when strain is in the 70–100 band
  const penalty = Math.min(10, Math.round((strain.score - 70) / 3));
  const penalized = Math.max(0, Math.min(100, base.score - penalty));
  return {
    ...base,
    score: penalized,
    label:
      penalized >= 80 ? 'Excellent' : penalized >= 60 ? 'Good' : penalized >= 40 ? 'Fair' : 'Poor',
  };
}
