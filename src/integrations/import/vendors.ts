/**
 * Vendor importers: convert third-party HRV exports into our Session
 * model so users can preserve historical baselines when switching from
 * Whoop / Oura / Garmin Connect / Elite HRV / HRV4Training.
 *
 * Every parser is a PURE function (string in → Session[] out) so it can
 * be tested with golden fixtures and run without touching SQLite.
 */
import { Session } from '../../types';

export type ImportSource = 'whoop' | 'oura' | 'garmin' | 'elite_hrv' | 'hrv4training';

export interface ImportResult {
  source: ImportSource;
  sessions: Session[];
  errors: { line: number; reason: string }[];
}

export function importHash(source: ImportSource, externalId: string): string {
  return `${source}:${externalId}`;
}

function uuidLike(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hex = h.toString(16).padStart(8, '0');
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(0, 3)}-${hex.padEnd(12, '0').slice(0, 12)}`;
}

function emptySession(timestamp: string, externalId: string, source: ImportSource): Session {
  return {
    id: uuidLike(`${source}:${externalId}`),
    timestamp,
    durationSeconds: 180,
    rrIntervals: [],
    rmssd: 0,
    sdnn: 0,
    meanHr: 0,
    pnn50: 0,
    artifactRate: 0,
    verdict: null,
    perceivedReadiness: null,
    trainingType: null,
    notes: `Imported from ${source} (${externalId})`,
    sleepHours: null,
    sleepQuality: null,
    stressLevel: null,
    source: 'chest_strap',
  };
}

export function parseWhoopCsv(csv: string): ImportResult {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: { line: number; reason: string }[] = [];
  const sessions: Session[] = [];
  if (lines.length < 2) return { source: 'whoop', sessions, errors };
  const header = splitCsvRow(lines[0]).map((s) => s.trim());
  const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const iStart = idx('Cycle start time');
  const iHrv = idx('Heart rate variability (ms)');
  const iRhr = idx('Resting heart rate (bpm)');
  const iRecovery = idx('Recovery score %');
  if (iStart < 0 || iHrv < 0) {
    errors.push({ line: 0, reason: 'Missing required columns: Cycle start time, HRV (ms)' });
    return { source: 'whoop', sessions, errors };
  }
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    const ts = cols[iStart];
    const hrv = parseFloat(cols[iHrv]);
    if (!ts || !Number.isFinite(hrv)) {
      errors.push({ line: i, reason: 'Invalid timestamp or HRV value' });
      continue;
    }
    const rhr = iRhr >= 0 ? parseFloat(cols[iRhr]) : NaN;
    const recovery = iRecovery >= 0 ? parseFloat(cols[iRecovery]) : NaN;
    const session = emptySession(new Date(ts).toISOString(), `${ts}`, 'whoop');
    session.rmssd = hrv;
    session.sdnn = hrv * 1.2;
    session.meanHr = Number.isFinite(rhr) ? rhr : 0;
    session.perceivedReadiness = Number.isFinite(recovery)
      ? Math.max(1, Math.min(5, Math.round(recovery / 20)))
      : null;
    sessions.push(session);
  }
  return { source: 'whoop', sessions, errors };
}

export function parseOuraJson(text: string): ImportResult {
  const errors: { line: number; reason: string }[] = [];
  const sessions: Session[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    errors.push({ line: 0, reason: `Invalid JSON: ${(e as Error).message}` });
    return { source: 'oura', sessions, errors };
  }
  type Reading = { day?: string; timestamp?: string; average_hrv?: number; score?: number };
  type Sleep = { day?: string; total_sleep_duration?: number; efficiency?: number };
  const data = parsed as { daily_readiness?: Reading[]; daily_sleep?: Sleep[] };
  const sleepByDay = new Map<string, Sleep>();
  for (const s of data.daily_sleep ?? []) if (s.day) sleepByDay.set(s.day, s);
  for (const r of data.daily_readiness ?? []) {
    const day = r.day ?? r.timestamp?.slice(0, 10);
    if (!day) {
      errors.push({ line: 0, reason: 'Reading missing day' });
      continue;
    }
    const hrv = r.average_hrv ?? 0;
    if (!Number.isFinite(hrv) || hrv <= 0) continue;
    const session = emptySession(new Date(day + 'T07:00:00Z').toISOString(), day, 'oura');
    session.rmssd = hrv;
    session.sdnn = hrv * 1.15;
    const sleep = sleepByDay.get(day);
    if (sleep?.total_sleep_duration) {
      session.sleepHours = sleep.total_sleep_duration / 3600;
    }
    if (typeof r.score === 'number') {
      session.perceivedReadiness = Math.max(1, Math.min(5, Math.round(r.score / 20)));
    }
    sessions.push(session);
  }
  return { source: 'oura', sessions, errors };
}

export function parseGarminCsv(csv: string): ImportResult {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: { line: number; reason: string }[] = [];
  const sessions: Session[] = [];
  if (lines.length < 2) return { source: 'garmin', sessions, errors };
  const header = splitCsvRow(lines[0]).map((s) => s.trim());
  const idx = (...names: string[]) =>
    header.findIndex((h) => names.some((n) => h.toLowerCase() === n.toLowerCase()));
  const iDate = idx('Date', 'date');
  const iRmssd = idx('RMSSD', 'HRV', 'Last Night Avg');
  const iSdnn = idx('SDNN');
  const iHr = idx('Avg HR', 'Resting HR', 'RHR');
  if (iDate < 0 || iRmssd < 0) {
    errors.push({ line: 0, reason: 'Missing required columns: Date, RMSSD/HRV' });
    return { source: 'garmin', sessions, errors };
  }
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    const date = cols[iDate];
    const rmssd = parseFloat(cols[iRmssd]);
    if (!date || !Number.isFinite(rmssd) || rmssd <= 0) {
      errors.push({ line: i, reason: 'Invalid date or RMSSD' });
      continue;
    }
    const session = emptySession(new Date(date + 'T07:00:00Z').toISOString(), date, 'garmin');
    session.rmssd = rmssd;
    session.sdnn = iSdnn >= 0 ? parseFloat(cols[iSdnn]) || rmssd * 1.2 : rmssd * 1.2;
    if (iHr >= 0) {
      const hr = parseFloat(cols[iHr]);
      if (Number.isFinite(hr)) session.meanHr = hr;
    }
    sessions.push(session);
  }
  return { source: 'garmin', sessions, errors };
}

function splitCsvRow(row: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === '"') {
      if (inQuote && row[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (c === ',' && !inQuote) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

export function parseImport(source: ImportSource, content: string): ImportResult {
  switch (source) {
    case 'whoop':
      return parseWhoopCsv(content);
    case 'oura':
      return parseOuraJson(content);
    case 'garmin':
      return parseGarminCsv(content);
    case 'elite_hrv':
    case 'hrv4training':
      return {
        source,
        sessions: [],
        errors: [{ line: 0, reason: `${source} importer not yet implemented` }],
      };
  }
}
