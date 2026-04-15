import { Session, DailyReading } from '../types';
import { getDatabase } from './database';
import { toDateString } from '../utils/date';

/**
 * Saves a new session to the database.
 */
export async function saveSession(session: Session): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO sessions (id, timestamp, duration_seconds, rr_intervals, rmssd, sdnn, mean_hr, pnn50, artifact_rate, verdict, perceived_readiness, training_type, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    session.notes
  );
}

/**
 * Updates the subjective log fields of a session.
 */
export async function updateSessionLog(
  sessionId: string,
  perceivedReadiness: number | null,
  trainingType: string | null,
  notes: string | null
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sessions SET perceived_readiness = ?, training_type = ?, notes = ? WHERE id = ?`,
    perceivedReadiness,
    trainingType,
    notes,
    sessionId
  );
}

/**
 * Gets today's first session (for home screen display).
 */
export async function getTodaySession(todayDateStr: string): Promise<Session | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SessionRow>(
    `SELECT * FROM sessions WHERE date(timestamp) = ? ORDER BY timestamp ASC LIMIT 1`,
    todayDateStr
  );
  return row ? mapRowToSession(row) : null;
}

/**
 * Gets all sessions, most recent first.
 */
export async function getAllSessions(): Promise<Session[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SessionRow>(
    `SELECT * FROM sessions ORDER BY timestamp DESC`
  );
  return rows.map(mapRowToSession);
}

/**
 * Gets sessions within a date range for history display.
 */
export async function getSessionsInRange(
  startDate: string,
  endDate: string
): Promise<Session[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SessionRow>(
    `SELECT * FROM sessions WHERE date(timestamp) >= ? AND date(timestamp) <= ? ORDER BY timestamp DESC`,
    startDate,
    endDate
  );
  return rows.map(mapRowToSession);
}

/**
 * Gets daily readings for baseline computation.
 * Returns the first reading of each day within the window.
 */
export async function getDailyReadings(windowDays: number): Promise<DailyReading[]> {
  const db = await getDatabase();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - windowDays);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  const rows = await db.getAllAsync<{ date_str: string; rmssd: number; verdict: string | null }>(
    `SELECT date(timestamp) as date_str, rmssd, verdict
     FROM sessions
     WHERE date(timestamp) >= ?
     GROUP BY date(timestamp)
     ORDER BY date(timestamp) ASC`,
    cutoffStr
  );

  return rows.map((r) => ({
    date: r.date_str,
    rmssd: r.rmssd,
    verdict: r.verdict as DailyReading['verdict'],
  }));
}

/**
 * Gets all session dates for streak calculation.
 */
export async function getSessionDates(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ date_str: string }>(
    `SELECT DISTINCT date(timestamp) as date_str FROM sessions ORDER BY date_str DESC`
  );
  return rows.map((r) => r.date_str);
}

/**
 * Gets a single session by ID.
 */
export async function getSessionById(id: string): Promise<Session | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SessionRow>(
    `SELECT * FROM sessions WHERE id = ?`,
    id
  );
  return row ? mapRowToSession(row) : null;
}

/**
 * Gets sessions from the last N days for chart data.
 */
export async function getRecentSessions(days: number): Promise<Session[]> {
  const db = await getDatabase();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  const rows = await db.getAllAsync<SessionRow>(
    `SELECT * FROM sessions WHERE date(timestamp) >= ? ORDER BY timestamp ASC`,
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
}

function mapRowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    timestamp: row.timestamp,
    durationSeconds: row.duration_seconds,
    rrIntervals: JSON.parse(row.rr_intervals),
    rmssd: row.rmssd,
    sdnn: row.sdnn,
    meanHr: row.mean_hr,
    pnn50: row.pnn50,
    artifactRate: row.artifact_rate,
    verdict: row.verdict as Session['verdict'],
    perceivedReadiness: row.perceived_readiness,
    trainingType: row.training_type,
    notes: row.notes,
  };
}
