/**
 * Watch companion bridge.
 *
 * Defines the data contract and shared HRV engine surface that native
 * watchOS (Swift) and Wear OS (Kotlin) companions consume. Native apps
 * record RR intervals on-wrist and hand off complete sessions to the
 * phone, where the shared TypeScript engine recomputes metrics so all
 * platforms produce byte-identical results.
 */
import { computeHrvMetrics } from '../hrv/metrics';
import { computeBaseline } from '../hrv/baseline';
import { computeVerdict } from '../hrv/verdict';
import { saveSession, getDailyReadings } from '../database/sessionRepository';
import { loadSettings } from '../database/settingsRepository';
import { generateId } from '../utils/uuid';
import { Session, SessionSource } from '../types';

/** Bump when the wire format changes; native ports must check. */
export const WATCH_BRIDGE_VERSION = 1;

/** Payload pushed from a watch companion when a session completes. */
export interface WatchSessionPayload {
  bridgeVersion: number;
  /** ISO 8601 UTC of recording start. */
  timestamp: string;
  /** Recording duration in seconds. */
  durationSeconds: number;
  /** Raw RR intervals in milliseconds, in chronological order. */
  rrIntervals: number[];
  /** Source platform identifier. */
  source: 'watchos' | 'wearos';
  /** Optional client-supplied id (for idempotency). */
  clientSessionId?: string;
}

export interface WatchIngestResult {
  sessionId: string;
  rmssd: number;
  verdict: Session['verdict'];
  duplicate: boolean;
}

/** Validates a watch bridge payload. Throws with a descriptive message. */
export function validateWatchPayload(payload: WatchSessionPayload): void {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Watch payload must be an object');
  }
  if (payload.bridgeVersion !== WATCH_BRIDGE_VERSION) {
    throw new Error(
      `Bridge version mismatch: expected ${WATCH_BRIDGE_VERSION}, got ${payload.bridgeVersion}`
    );
  }
  if (typeof payload.timestamp !== 'string' || Number.isNaN(Date.parse(payload.timestamp))) {
    throw new Error('Watch payload `timestamp` must be ISO 8601');
  }
  if (typeof payload.durationSeconds !== 'number' || payload.durationSeconds <= 0) {
    throw new Error('Watch payload `durationSeconds` must be > 0');
  }
  if (!Array.isArray(payload.rrIntervals) || payload.rrIntervals.length < 30) {
    throw new Error('Watch payload requires at least 30 RR intervals');
  }
  if (payload.source !== 'watchos' && payload.source !== 'wearos') {
    throw new Error(`Unknown watch source: ${payload.source}`);
  }
}

/**
 * Ingests a watch session. Recomputes metrics on the phone for cross-platform
 * consistency, computes verdict against the user's baseline, and persists.
 * Idempotent by `clientSessionId`.
 */
export async function ingestWatchSession(payload: WatchSessionPayload): Promise<WatchIngestResult> {
  validateWatchPayload(payload);

  const settings = await loadSettings();
  const metrics = computeHrvMetrics(payload.rrIntervals);
  const dailyReadings = await getDailyReadings(settings.baselineWindowDays);
  const baseline = computeBaseline(dailyReadings, settings.baselineWindowDays);
  const verdict = computeVerdict(metrics.rmssd, baseline, settings);

  const sessionId = payload.clientSessionId ?? generateId();
  const session: Session = {
    id: sessionId,
    timestamp: payload.timestamp,
    durationSeconds: payload.durationSeconds,
    rrIntervals: payload.rrIntervals,
    rmssd: metrics.rmssd,
    sdnn: metrics.sdnn,
    meanHr: metrics.meanHr,
    pnn50: metrics.pnn50,
    artifactRate: metrics.artifactRate,
    verdict,
    perceivedReadiness: null,
    trainingType: null,
    notes: null,
    sleepHours: null,
    sleepQuality: null,
    stressLevel: null,
    // Watch sessions use optical PPG; treat like camera for baseline purposes.
    source: 'camera' as SessionSource,
  };

  try {
    await saveSession(session);
    return { sessionId, rmssd: metrics.rmssd, verdict, duplicate: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE') || message.includes('constraint')) {
      return { sessionId, rmssd: metrics.rmssd, verdict, duplicate: true };
    }
    throw err;
  }
}

/** Snapshot consumed by watch complications. */
export interface WatchComplicationSnapshot {
  bridgeVersion: number;
  updatedAt: string;
  verdict: Session['verdict'];
  rmssd: number | null;
  baselineMedian: number | null;
  percentOfBaseline: number | null;
  baselineDayCount: number;
}

export function buildComplicationSnapshot(
  todaySession: Session | null,
  baselineMedian: number,
  baselineDayCount: number
): WatchComplicationSnapshot {
  const percent =
    todaySession && baselineMedian > 0
      ? Math.round((todaySession.rmssd / baselineMedian) * 100)
      : null;

  return {
    bridgeVersion: WATCH_BRIDGE_VERSION,
    updatedAt: new Date().toISOString(),
    verdict: todaySession?.verdict ?? null,
    rmssd: todaySession?.rmssd ?? null,
    baselineMedian: baselineMedian > 0 ? baselineMedian : null,
    percentOfBaseline: percent,
    baselineDayCount,
  };
}
