/**
 * Open HRV Protocol — interchange spec for sessions, baselines, and metrics.
 *
 * Stable JSON wire format that third-party tools, research platforms, and
 * the upcoming web dashboard can produce or consume. Versioned so the
 * shape can evolve without breaking older readers.
 */
import { Session, BaselineResult, VerdictType } from '../types';

export const OHP_VERSION = 1;

/** Wire-format spec (camelCase, all-string timestamps, ms-valued metrics). */
export interface OhpSession {
  schemaVersion: number;
  id: string;
  timestamp: string;
  durationSeconds: number;
  source: 'chest_strap' | 'camera' | 'watchos' | 'wearos' | string;
  rrIntervalsMs: number[];
  metrics: {
    rmssd: number;
    sdnn: number;
    meanHr: number;
    pnn50: number;
    artifactRate: number;
  };
  verdict: VerdictType | null;
  context?: {
    perceivedReadiness?: number | null;
    trainingType?: string | null;
    sleepHours?: number | null;
    sleepQuality?: number | null;
    stressLevel?: number | null;
    notes?: string | null;
  };
}

export interface OhpBundle {
  schemaVersion: number;
  generatedAt: string;
  generator: { name: string; version: string };
  baseline?: { median: number; dayCount: number; windowDays: number };
  sessions: OhpSession[];
}

export function toOhpSession(session: Session): OhpSession {
  return {
    schemaVersion: OHP_VERSION,
    id: session.id,
    timestamp: session.timestamp,
    durationSeconds: session.durationSeconds,
    source: session.source,
    rrIntervalsMs: session.rrIntervals,
    metrics: {
      rmssd: session.rmssd,
      sdnn: session.sdnn,
      meanHr: session.meanHr,
      pnn50: session.pnn50,
      artifactRate: session.artifactRate,
    },
    verdict: session.verdict,
    context: {
      perceivedReadiness: session.perceivedReadiness,
      trainingType: session.trainingType,
      sleepHours: session.sleepHours,
      sleepQuality: session.sleepQuality,
      stressLevel: session.stressLevel,
      notes: session.notes,
    },
  };
}

export function fromOhpSession(o: OhpSession): Session {
  if (o.schemaVersion > OHP_VERSION) {
    throw new Error(
      `OHP session schema v${o.schemaVersion} is newer than this client (v${OHP_VERSION})`
    );
  }
  const allowedSources = new Set(['chest_strap', 'camera']);
  return {
    id: o.id,
    timestamp: o.timestamp,
    durationSeconds: o.durationSeconds,
    rrIntervals: o.rrIntervalsMs ?? [],
    rmssd: o.metrics?.rmssd ?? 0,
    sdnn: o.metrics?.sdnn ?? 0,
    meanHr: o.metrics?.meanHr ?? 0,
    pnn50: o.metrics?.pnn50 ?? 0,
    artifactRate: o.metrics?.artifactRate ?? 0,
    verdict: o.verdict ?? null,
    perceivedReadiness: o.context?.perceivedReadiness ?? null,
    trainingType: o.context?.trainingType ?? null,
    notes: o.context?.notes ?? null,
    sleepHours: o.context?.sleepHours ?? null,
    sleepQuality: o.context?.sleepQuality ?? null,
    stressLevel: o.context?.stressLevel ?? null,
    source: allowedSources.has(o.source) ? (o.source as Session['source']) : 'chest_strap',
  };
}

export function buildOhpBundle(
  sessions: Session[],
  generator: { name: string; version: string },
  baseline?: BaselineResult & { windowDays: number }
): OhpBundle {
  return {
    schemaVersion: OHP_VERSION,
    generatedAt: new Date().toISOString(),
    generator,
    baseline: baseline
      ? { median: baseline.median, dayCount: baseline.dayCount, windowDays: baseline.windowDays }
      : undefined,
    sessions: sessions.map(toOhpSession),
  };
}

export interface OhpValidationResult {
  ok: boolean;
  errors: string[];
}

/** Validates a parsed JSON object against the OHP bundle schema. */
export function validateOhpBundle(input: unknown): OhpValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') {
    return { ok: false, errors: ['Bundle must be an object'] };
  }
  const b = input as Partial<OhpBundle>;
  if (typeof b.schemaVersion !== 'number') errors.push('Missing schemaVersion');
  if (b.schemaVersion !== undefined && b.schemaVersion > OHP_VERSION) {
    errors.push(`schemaVersion ${b.schemaVersion} is newer than client (${OHP_VERSION})`);
  }
  if (!Array.isArray(b.sessions)) errors.push('sessions must be an array');
  else {
    b.sessions.forEach((s, i) => {
      if (!s.id) errors.push(`sessions[${i}].id is required`);
      if (!s.timestamp || Number.isNaN(Date.parse(s.timestamp))) {
        errors.push(`sessions[${i}].timestamp must be ISO 8601`);
      }
      if (!Array.isArray(s.rrIntervalsMs)) {
        errors.push(`sessions[${i}].rrIntervalsMs must be an array`);
      }
      if (!s.metrics || typeof s.metrics.rmssd !== 'number') {
        errors.push(`sessions[${i}].metrics.rmssd is required`);
      }
    });
  }
  return { ok: errors.length === 0, errors };
}
