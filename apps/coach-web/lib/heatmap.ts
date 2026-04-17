/**
 * Pure-function builder for a 30-day verdict heatmap grid. Used by the
 * coach web's athlete drill-down page. Returns a row-per-week, column-
 * per-weekday matrix anchored on the most recent date so the bottom-
 * right cell is always "today".
 */
import { Session, VerdictType } from '../../../src/types';

export interface HeatmapCell {
  date: string; // YYYY-MM-DD
  verdict: VerdictType | null;
  rmssd: number | null;
}

export interface HeatmapGrid {
  weeks: HeatmapCell[][]; // weeks[y][x], x = 0..6 (Mon..Sun)
  start: string;
  end: string;
}

const MS_PER_DAY = 86_400_000;

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfMondayWeek(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayOfWeek = (out.getUTCDay() + 6) % 7; // Mon = 0
  out.setUTCDate(out.getUTCDate() - dayOfWeek);
  return out;
}

export function buildHeatmap(sessions: Session[], now: Date = new Date(), days = 30): HeatmapGrid {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startInclusive = new Date(end.getTime() - (days - 1) * MS_PER_DAY);
  const gridStart = startOfMondayWeek(startInclusive);

  const byDate = new Map<string, Session>();
  for (const s of sessions) {
    const key = ymd(new Date(s.timestamp));
    const existing = byDate.get(key);
    if (!existing || new Date(s.timestamp) > new Date(existing.timestamp)) {
      byDate.set(key, s);
    }
  }

  const weeks: HeatmapCell[][] = [];
  let cursor = new Date(gridStart);
  while (cursor.getTime() <= end.getTime()) {
    const row: HeatmapCell[] = [];
    for (let i = 0; i < 7; i++) {
      const key = ymd(cursor);
      const inRange = cursor.getTime() >= startInclusive.getTime() && cursor.getTime() <= end.getTime();
      const s = inRange ? byDate.get(key) ?? null : null;
      row.push({
        date: key,
        verdict: s?.verdict ?? null,
        rmssd: s?.rmssd ?? null,
      });
      cursor = new Date(cursor.getTime() + MS_PER_DAY);
    }
    weeks.push(row);
  }
  return { weeks, start: ymd(startInclusive), end: ymd(end) };
}

export function verdictColor(v: VerdictType | null): string {
  switch (v) {
    case 'go_hard': return '#22C55E';
    case 'moderate': return '#F59E0B';
    case 'rest': return '#EF4444';
    default: return '#1E293B';
  }
}
