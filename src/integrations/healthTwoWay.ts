/**
 * Two-way HealthKit / Health Connect controller.
 *
 * Composes the existing one-way write pipeline (`utils/healthSync.ts`)
 * and one-way sleep read (`integrations/healthAutoPull.ts`) into a
 * single surface the Settings screen and Reading screen can call:
 *
 *   - `requestHealthAccess()` – read + write permissions (single sheet)
 *   - `pullForReading(now)`   – sleep hours + resting HR for today
 *   - `pushSession(session)`  – rMSSD + meanHR back to the health store
 *
 * Conflict resolution is deliberately simple: pulled values populate
 * only NULL fields (manual entries always win). Provenance is tracked
 * via `mergeAutoPull`.
 */
import { Platform } from 'react-native';
import { Session } from '../types';
import {
  isHealthSyncAvailable,
  requestHealthPermissions,
  syncSessionToHealth,
} from '../utils/healthSync';
import { autoPullSleep, AutoPullResult, mergeAutoPull, ProvenancedSession } from './healthAutoPull';

export interface TwoWayPull extends AutoPullResult {
  restingHr: number | null;
}

/** Best-effort RHR pull from the underlying SDK; null when unavailable. */
async function readRestingHr(now: Date): Promise<number | null> {
  try {
    // The SDK module loader lives in healthSync.ts but we re-import via
    // the same require strategy here to avoid circular imports.
    let mod: { default?: unknown } | null = null;
    try {
      if (Platform.OS === 'ios') {
        mod = require('react-native-health');
      } else if (Platform.OS === 'android') {
        mod = require('react-native-health-connect');
      }
    } catch {
      return null;
    }
    if (!mod) return null;
    // Per-platform shape varies; we attempt the common method names and
    // return null for anything that doesn't fit. The Settings screen
    // shows a "manual entry" hint when null.
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sdk = mod as Record<string, unknown>;
    const fn = (sdk.getRestingHeartRateSamples ?? sdk.readRestingHeartRate) as
      | ((
          opts: unknown
        ) => Promise<
          { value: number }[] | { records?: { samplesData?: { beatsPerMinute?: number }[] }[] }
        >)
      | undefined;
    if (typeof fn !== 'function') return null;
    const samples = await fn({ startDate: since.toISOString(), endDate: now.toISOString() });
    if (Array.isArray(samples)) {
      const values = samples.map((s) => s.value).filter((v): v is number => Number.isFinite(v));
      return values.length ? values[values.length - 1] : null;
    }
    if ('records' in samples) {
      const recs = samples.records ?? [];
      for (const r of recs) {
        const sd = r.samplesData ?? [];
        for (const sv of sd) if (typeof sv.beatsPerMinute === 'number') return sv.beatsPerMinute;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Requests unified read + write health permissions.
 * @returns `true` if all required permissions were granted.
 */
export async function requestHealthAccess(): Promise<boolean> {
  if (!isHealthSyncAvailable()) return false;
  return requestHealthPermissions();
}

/**
 * Pulls sleep data and resting heart rate for the current morning.
 *
 * Composes `autoPullSleep` (for sleep hours/quality) with a best-effort
 * resting HR read from the native SDK. Returns `null` fields when data
 * is unavailable rather than throwing.
 */
export async function pullForReading(now: Date = new Date()): Promise<TwoWayPull> {
  const sleep = await autoPullSleep(now);
  const restingHr = await readRestingHr(now);
  return { ...sleep, restingHr };
}

/** Merge a pulled snapshot into a session and (best-effort) push the result back. */
export async function syncBoth(
  session: Session,
  pulled: TwoWayPull
): Promise<{ merged: ProvenancedSession; pushed: boolean }> {
  const merged = mergeAutoPull(session, pulled);
  let pushed = false;
  if (isHealthSyncAvailable()) {
    try {
      pushed = await syncSessionToHealth(merged);
    } catch {
      pushed = false;
    }
  }
  return { merged, pushed };
}
