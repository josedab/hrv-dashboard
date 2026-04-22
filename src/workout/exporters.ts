/**
 * External workout export adapters.
 *
 * Pushes a {@link WorkoutPrescription} to third-party platforms in their
 * native structured-workout formats so users can execute the suggested
 * session without re-creating it manually.
 *
 * - Strava: structured workouts not supported via public API → push as
 *   activity description / planned workout note.
 * - TrainingPeaks: workout XML upload via partner API (token required).
 * - Intervals.icu: simple POST /api/v1/athlete/{id}/events with a
 *   workout_doc payload (Intervals' Power-zone format).
 *
 * Network is injected via `fetchImpl` for tests.
 */
import { WorkoutPrescription, toZwoXml } from './generator';

/** Configuration for platform export APIs (access token + optional fetch override for tests). */
export interface ExportConfig {
  accessToken: string;
  fetchImpl?: typeof fetch;
}

/** Result of a platform export attempt. Check `ok` before reading other fields. */
export interface ExportResult {
  ok: boolean;
  externalId?: string;
  url?: string;
  error?: string;
}

function fetchOrDefault(c: ExportConfig): typeof fetch {
  return c.fetchImpl ?? (globalThis as { fetch: typeof fetch }).fetch;
}

/** Strava planned-workout note (no structured payload exists today). */
export async function pushToStrava(
  workout: WorkoutPrescription,
  date: string,
  config: ExportConfig
): Promise<ExportResult> {
  const fetchImpl = fetchOrDefault(config);
  const description = renderPlainText(workout);
  const response = await fetchImpl('https://www.strava.com/api/v3/uploads', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Planned: ${workout.headline}`,
      description,
      data_type: 'planned',
      external_id: `hrv-${date}`,
    }),
  });
  if (!response.ok) {
    return { ok: false, error: `Strava HTTP ${response.status}` };
  }
  const json = (await response.json()) as { id?: number; status?: string };
  return {
    ok: true,
    externalId: json.id ? String(json.id) : undefined,
    url: json.id ? `https://www.strava.com/uploads/${json.id}` : undefined,
  };
}

/** TrainingPeaks workout XML upload (workout_xml payload). */
export async function pushToTrainingPeaks(
  workout: WorkoutPrescription,
  date: string,
  athleteId: string,
  config: ExportConfig
): Promise<ExportResult> {
  const fetchImpl = fetchOrDefault(config);
  const xml = toZwoXml(workout);
  const response = await fetchImpl(
    `https://api.trainingpeaks.com/v1/athletes/${encodeURIComponent(athleteId)}/workouts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workoutDate: date,
        title: workout.headline,
        description: renderPlainText(workout),
        workoutFileFormat: 'ZWO',
        workoutFile: xml,
      }),
    }
  );
  if (!response.ok) return { ok: false, error: `TrainingPeaks HTTP ${response.status}` };
  const json = (await response.json()) as { workoutId?: string | number };
  return {
    ok: true,
    externalId: json.workoutId !== undefined ? String(json.workoutId) : undefined,
  };
}

/** Intervals.icu workout event upload. */
export async function pushToIntervalsIcu(
  workout: WorkoutPrescription,
  date: string,
  athleteId: string,
  config: ExportConfig
): Promise<ExportResult> {
  const fetchImpl = fetchOrDefault(config);
  const doc = renderIntervalsDoc(workout);
  const response = await fetchImpl(
    `https://intervals.icu/api/v1/athlete/${encodeURIComponent(athleteId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${base64(`API_KEY:${config.accessToken}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        category: 'WORKOUT',
        start_date_local: `${date}T07:00:00`,
        type: workout.sport === 'running' ? 'Run' : 'Ride',
        name: workout.headline,
        description: workout.rationale,
        workout_doc: doc,
      }),
    }
  );
  if (!response.ok) return { ok: false, error: `Intervals.icu HTTP ${response.status}` };
  const json = (await response.json()) as { id?: string | number };
  return {
    ok: true,
    externalId: json.id !== undefined ? String(json.id) : undefined,
  };
}

/** Render workout as plain-text description (used by Strava). */
export function renderPlainText(workout: WorkoutPrescription): string {
  const lines: string[] = [];
  lines.push(workout.headline);
  lines.push('');
  for (const block of workout.blocks) {
    const reps = block.reps && block.reps > 1 ? `${block.reps}× ` : '';
    const dur =
      block.durationSeconds >= 60
        ? `${Math.round(block.durationSeconds / 60)} min`
        : `${block.durationSeconds}s`;
    lines.push(`• ${reps}${dur} @ ${block.zone.label} — ${block.description}`);
  }
  lines.push('');
  lines.push(workout.rationale);
  lines.push('');
  lines.push('Generated from HRV readiness — not medical advice.');
  return lines.join('\n');
}

/** Render workout as Intervals.icu workout_doc structure. */
export function renderIntervalsDoc(workout: WorkoutPrescription): {
  description: string;
  steps: { duration: number; power: { value: number; units: string }; reps?: number }[];
} {
  return {
    description: workout.headline,
    steps: workout.blocks.map((b) => ({
      duration: b.durationSeconds,
      power: { value: zoneMidpointPct(b.zone), units: 'percent_ftp' },
      ...(b.reps && b.reps > 1 ? { reps: b.reps } : {}),
    })),
  };
}

function zoneMidpointPct(zone: { intensity: { low: number; high: number } }): number {
  return Math.round(((zone.intensity.low + zone.intensity.high) / 2) * 100);
}

function base64(s: string): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf-8').toString('base64');
  const btoa = (globalThis as { btoa?: (s: string) => string }).btoa;
  if (btoa) return btoa(s);
  throw new Error('No base64 encoder available (neither Buffer nor btoa)');
}
