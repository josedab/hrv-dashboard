/**
 * Session persistence layer (SQLite).
 *
 * CRUD operations for HRV recording sessions, plus query helpers for
 * date-range filtering, pagination, daily aggregation, and streak
 * counting. All functions are async and use the singleton database
 * connection from {@link getDatabase}.
 */
import { Session, DailyReading, SessionLogPatch, parseVerdict, parseSessionSource } from '../types';
import { getDatabase } from './database';

/**
 * Saves a new session to the database.
 */
export async function saveSession(session: Session): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO sessions (id, timestamp, duration_seconds, rr_intervals, rmssd, sdnn, mean_hr, pnn50, artifact_rate, verdict, perceived_readiness, training_type, notes, sleep_hours, sleep_quality, stress_level, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    session.id,
    session.timestamp,
    session.durationSeconds,
    JSON.stringify(session.rrIntervals),
    session.rmssd,
    session.sdnn,
    session.meanHr,
    session.pnn50,
    session.artifactRate,
    session.verdict,
    session.perceivedReadiness,
    session.trainingType,
    session.notes,
    session.sleepHours,
    session.sleepQuality,
    session.stressLevel,
    session.source
  );
}

/**
 * Deletes a session by id. Idempotent: silent if id is not present.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM sessions WHERE id = ?`, sessionId);
}

/**
 * Updates the subjective log fields of a session.
 *
 * Only fields explicitly present on `patch` are written; missing fields are
 * preserved. Pass `null` to clear an existing value.
 */
export async function updateSessionLog(sessionId: string, patch: SessionLogPatch): Promise<void> {
  // Map patch keys to (column, value) pairs only when defined, so a UI that
  // only renders a subset of fields cannot accidentally null out the rest.
  const columnMap: Record<keyof SessionLogPatch, string> = {
    perceivedReadiness: 'perceived_readiness',
    trainingType: 'training_type',
    notes: 'notes',
    sleepHours: 'sleep_hours',
    sleepQuality: 'sleep_quality',
    stressLevel: 'stress_level',
  };

  const assignments: string[] = [];
  const values: unknown[] = [];
  for (const key of Object.keys(columnMap) as (keyof SessionLogPatch)[]) {
    if (patch[key] !== undefined) {
      assignments.push(`${columnMap[key]} = ?`);
      values.push(patch[key]);
    }
  }
  if (assignments.length === 0) return;

  values.push(sessionId);
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sessions SET ${assignments.join(', ')} WHERE id = ?`,
    ...(values as never[])
  );
}

/**
 * Gets today's first session (for home screen display).
 * Uses localtime to match the user's local calendar day.
 */
export async function getTodaySession(todayDateStr: string): Promise<Session | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SessionRow>(
    `SELECT * FROM sessions WHERE date(timestamp, 'localtime') = ? ORDER BY timestamp ASC LIMIT 1`,
    todayDateStr
  );
  return row ? mapRowToSession(row) : null;
}

/**
 * Gets all sessions, most recent first.
 */
export async function getAllSessions(): Promise<Session[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SessionRow>(`SELECT * FROM sessions ORDER BY timestamp DESC`);
  return rows.map(mapRowToSession);
}

/**
 * Gets a paginated list of sessions, most recent first.
 * Uses stable sort (timestamp DESC, id DESC) to avoid duplicates.
 */
export async function getSessionsPaginated(limit: number, offset: number): Promise<Session[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SessionRow>(
    `SELECT * FROM sessions ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`,
    limit,
    offset
  );
  return rows.map(mapRowToSession);
}

/**
 * Gets the total number of sessions.
 */
export async function getSessionCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM sessions`);
  return row?.count ?? 0;
}

/**
 * Gets sessions within a date range for history display.
 * Uses localtime to match the user's local calendar days.
 */
export async function getSessionsInRange(startDate: string, endDate: string): Promise<Session[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SessionRow>(
    `SELECT * FROM sessions WHERE date(timestamp, 'localtime') >= ? AND date(timestamp, 'localtime') <= ? ORDER BY timestamp DESC`,
    startDate,
    endDate
  );
  return rows.map(mapRowToSession);
}

/**
 * Gets daily readings for baseline computation.
 * Returns the first chest-strap reading of each local calendar day within the window.
 * Camera-based PPG sessions are excluded because their accuracy is materially lower
 * and would bias the baseline.
 */
export async function getDailyReadings(windowDays: number): Promise<DailyReading[]> {
  const db = await getDatabase();
  const cutoff = new Date();
  const cutoffDate = new Date(
    cutoff.getFullYear(),
    cutoff.getMonth(),
    cutoff.getDate() - windowDays,
    12
  );
  const cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`;

  const rows = await db.getAllAsync<{ date_str: string; rmssd: number; verdict: string | null }>(
    `SELECT date(s.timestamp, 'localtime') as date_str, s.rmssd, s.verdict
     FROM sessions s
     INNER JOIN (
       SELECT date(timestamp, 'localtime') as day, MIN(timestamp) as first_ts
       FROM sessions
       WHERE date(timestamp, 'localtime') >= ?
         AND source = 'chest_strap'
       GROUP BY date(timestamp, 'localtime')
     ) first ON s.timestamp = first.first_ts
     ORDER BY date_str ASC`,
    cutoffStr
  );

  return rows.map((r) => ({
    date: r.date_str,
    rmssd: r.rmssd,
    verdict: parseVerdict(r.verdict),
  }));
}

/**
 * Gets all session dates (local time) for streak calculation.
 */
export async function getSessionDates(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ date_str: string }>(
    `SELECT DISTINCT date(timestamp, 'localtime') as date_str FROM sessions ORDER BY date_str DESC`
  );
  return rows.map((r) => r.date_str);
}

/**
 * Gets a single session by ID.
 */
export async function getSessionById(id: string): Promise<Session | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SessionRow>(`SELECT * FROM sessions WHERE id = ?`, id);
  return row ? mapRowToSession(row) : null;
}

/**
 * Gets sessions from the last N days for chart data.
 * Uses localtime for consistent day boundaries.
 */
export async function getRecentSessions(days: number): Promise<Session[]> {
  const db = await getDatabase();
  const cutoff = new Date();
  const cutoffDate = new Date(cutoff.getFullYear(), cutoff.getMonth(), cutoff.getDate() - days, 12);
  const cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`;

  const rows = await db.getAllAsync<SessionRow>(
    `SELECT * FROM sessions WHERE date(timestamp, 'localtime') >= ? ORDER BY timestamp ASC`,
    cutoffStr
  );
  return rows.map(mapRowToSession);
}

// Internal types and helpers

interface SessionRow {
  id: string;
  timestamp: string;
  duration_seconds: number;
  rr_intervals: string;
  rmssd: number;
  sdnn: number;
  mean_hr: number;
  pnn50: number;
  artifact_rate: number;
  verdict: string | null;
  perceived_readiness: number | null;
  training_type: string | null;
  notes: string | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  stress_level: number | null;
  source: string | null;
}

function parseRrIntervals(json: string): number[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      console.warn(
        '[sessionRepository] rr_intervals is not an array, returning empty. Got type:',
        typeof parsed
      );
      return [];
    }
    return parsed;
  } catch (e) {
    console.error(
      '[sessionRepository] Corrupt rr_intervals JSON, returning empty array.',
      'Length:',
      json.length,
      'Preview:',
      json.slice(0, 80),
      'Error:',
      e instanceof Error ? e.message : String(e)
    );
    return [];
  }
}

function mapRowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    timestamp: row.timestamp,
    durationSeconds: row.duration_seconds,
    rrIntervals: parseRrIntervals(row.rr_intervals),
    rmssd: row.rmssd,
    sdnn: row.sdnn,
    meanHr: row.mean_hr,
    pnn50: row.pnn50,
    artifactRate: row.artifact_rate,
    verdict: parseVerdict(row.verdict),
    perceivedReadiness: row.perceived_readiness,
    trainingType: row.training_type,
    notes: row.notes,
    sleepHours: row.sleep_hours ?? null,
    sleepQuality: row.sleep_quality ?? null,
    stressLevel: row.stress_level ?? null,
    source: parseSessionSource(row.source),
  };
}

/**
 * Bulk-inserts sessions, skipping any whose `id` already exists.
 *
 * Used by backup/restore. Wrapped in a single transaction for atomicity and
 * speed. Uses INSERT OR IGNORE to prevent crashes if a concurrent caller
 * inserts the same session between our existence check and our INSERT.
 * Returns the count of newly inserted rows.
 */
export async function upsertManySessionsIfMissing(sessions: Session[]): Promise<number> {
  if (sessions.length === 0) return 0;
  const db = await getDatabase();
  let inserted = 0;
  await db.withTransactionAsync(async () => {
    for (const session of sessions) {
      if (!session.id || !session.timestamp) continue;
      const existing = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM sessions WHERE id = ?`,
        session.id
      );
      if (existing) continue;
      // INSERT OR IGNORE guards against TOCTOU: if a concurrent caller inserted
      // this id between our SELECT and this INSERT, we silently skip instead of crashing.
      await db.runAsync(
        `INSERT OR IGNORE INTO sessions (id, timestamp, duration_seconds, rr_intervals, rmssd, sdnn, mean_hr, pnn50, artifact_rate, verdict, perceived_readiness, training_type, notes, sleep_hours, sleep_quality, stress_level, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        session.id,
        session.timestamp,
        session.durationSeconds ?? 0,
        JSON.stringify(session.rrIntervals ?? []),
        session.rmssd ?? 0,
        session.sdnn ?? 0,
        session.meanHr ?? 0,
        session.pnn50 ?? 0,
        session.artifactRate ?? 0,
        session.verdict ?? null,
        session.perceivedReadiness ?? null,
        session.trainingType ?? null,
        session.notes ?? null,
        session.sleepHours ?? null,
        session.sleepQuality ?? null,
        session.stressLevel ?? null,
        parseSessionSource(session.source)
      );
      inserted++;
    }
  });
  return inserted;
}
