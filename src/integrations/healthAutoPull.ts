/**
 * Provenance for fields written into the recovery score.
 *
 * Tracks whether sleep / RHR came from the user's manual log entry or
 * was auto-pulled from HealthKit / Health Connect. Exposed in the UI
 * via small badges so the user knows what's editable.
 */
import { Session } from '../types';
import { readLastNightSleep } from './healthSleep';

export type DataSource = 'manual' | 'health_kit' | 'health_connect' | 'auto';

export interface ProvenancedSession extends Session {
  provenance: {
    sleepHours?: DataSource;
    sleepQuality?: DataSource;
    stressLevel?: DataSource;
  };
}

export interface AutoPullResult {
  /** Hours of sleep last night, or null if unavailable. */
  sleepHours: number | null;
  /** 1–5 quality score, or null. */
  sleepQuality: number | null;
  /** Source that produced the values. */
  source: DataSource;
}

/**
 * Pull last-night sleep from the platform health store. Used on the
 * Reading screen post-recording so the Log screen pre-fills.
 *
 * Falls back to {sleepHours: null} when the SDK is not installed or
 * permissions are denied. Never throws.
 */
export async function autoPullSleep(now: Date = new Date()): Promise<AutoPullResult> {
  try {
    const summary = await readLastNightSleep(now);
    if (!summary) return { sleepHours: null, sleepQuality: null, source: 'manual' };
    // Health Connect (Android) and HealthKit both surface via the same module
    const platform = (globalThis as { Platform?: { OS?: string } }).Platform?.OS;
    const source: DataSource =
      platform === 'android' ? 'health_connect' : platform === 'ios' ? 'health_kit' : 'auto';
    return {
      sleepHours: summary.hoursTotal ?? null,
      sleepQuality: summary.qualityEstimate ?? null,
      source,
    };
  } catch {
    return { sleepHours: null, sleepQuality: null, source: 'manual' };
  }
}

/**
 * Merge auto-pulled values into a session, only when the corresponding
 * manual field is null. Returns the augmented session + provenance.
 */
export function mergeAutoPull(session: Session, pulled: AutoPullResult): ProvenancedSession {
  const provenance: ProvenancedSession['provenance'] = {};
  let merged: Session = session;
  if (session.sleepHours === null && pulled.sleepHours !== null) {
    const clampedHours = Math.max(0, Math.min(24, pulled.sleepHours));
    merged = { ...merged, sleepHours: Number.isFinite(clampedHours) ? clampedHours : null };
    if (merged.sleepHours !== null) provenance.sleepHours = pulled.source;
  } else if (session.sleepHours !== null) {
    provenance.sleepHours = 'manual';
  }
  if (session.sleepQuality === null && pulled.sleepQuality !== null) {
    const clampedQuality = Math.max(1, Math.min(5, Math.round(pulled.sleepQuality)));
    merged = { ...merged, sleepQuality: Number.isFinite(clampedQuality) ? clampedQuality : null };
    if (merged.sleepQuality !== null) provenance.sleepQuality = pulled.source;
  } else if (session.sleepQuality !== null) {
    provenance.sleepQuality = 'manual';
  }
  if (session.stressLevel !== null) provenance.stressLevel = 'manual';
  return { ...merged, provenance };
}
