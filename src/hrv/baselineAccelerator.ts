/**
 * Onboarding baseline accelerator.
 *
 * Computes an initial baseline from imported sessions so new users
 * see their first verdict immediately after data import, rather than
 * waiting 5 days for organic baseline accumulation.
 */
import { Session, BaselineResult } from '../types';
import { computeBaseline, isInsufficientBaseline } from '../hrv/baseline';

export interface AcceleratorResult {
  /** Computed baseline from imported data. */
  baseline: BaselineResult;
  /** Whether the imported data was sufficient for a verdict. */
  ready: boolean;
  /** Number of imported sessions used. */
  sessionsUsed: number;
  /** Number of distinct days with data. */
  daysUsed: number;
  /** User-facing status message. */
  message: string;
}

/**
 * Attempts to compute a baseline from imported sessions.
 * @returns AcceleratorResult with baseline, readiness flag, and status message.
 * Filters to chest_strap source only and takes the first reading per day.
 */
export function accelerateBaseline(
  importedSessions: Session[],
  baselineWindowDays: number = 7
): AcceleratorResult {
  if (importedSessions.length === 0) {
    return {
      baseline: { median: 0, dayCount: 0, values: [] },
      ready: false,
      sessionsUsed: 0,
      daysUsed: 0,
      message: 'No sessions to import. Record your first reading to get started.',
    };
  }

  // Filter to chest-strap sessions and take first per day
  const chestStrap = importedSessions.filter((s) => s.source === 'chest_strap');
  const byDate = new Map<string, Session>();
  for (const s of chestStrap) {
    const date = s.timestamp.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, s);
  }

  const dailyReadings = [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a)) // most recent first
    .slice(0, baselineWindowDays)
    .map(([date, s]) => ({ date, rmssd: s.rmssd, verdict: s.verdict }));

  const baseline = computeBaseline(dailyReadings);
  const ready = !isInsufficientBaseline(baseline);

  let message: string;
  if (ready) {
    message = `Baseline computed from ${baseline.dayCount} imported days. Your first live reading will refine it.`;
  } else if (dailyReadings.length > 0) {
    const needed = 5 - baseline.dayCount;
    message = `Imported ${baseline.dayCount} days of data. ${needed} more day${needed === 1 ? '' : 's'} needed for your first verdict.`;
  } else {
    message =
      'No compatible sessions found in import. Camera-based sessions are excluded from baseline.';
  }

  return {
    baseline,
    ready,
    sessionsUsed: chestStrap.length,
    daysUsed: baseline.dayCount,
    message,
  };
}
