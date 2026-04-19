/**
 * Training Stress Balance (TSB) model.
 *
 * Implements the Fitness/Fatigue/Form model commonly used in endurance
 * sports (Banister impulse-response). Computes:
 *   - ATL (Acute Training Load): 7-day exponentially weighted load
 *   - CTL (Chronic Training Load): 42-day exponentially weighted load
 *   - TSB (Training Stress Balance): CTL - ATL
 *
 * Positive TSB = fresh/recovered, negative TSB = fatigued.
 * Optimal performance window: TSB between -10 and +15.
 *
 * Uses the daily training load from {@link estimateTrainingLoad} as
 * the daily stress input.
 */
import { Session } from '../types';
import { estimateTrainingLoad } from './recovery';

/** Default time constants (days) for the exponential decay. */
const ATL_TIME_CONSTANT = 7;
const CTL_TIME_CONSTANT = 42;
const MS_PER_DAY = 86_400_000;

export interface DailyLoad {
  date: string;
  load: number;
}

export interface TsbPoint {
  date: string;
  /** Acute Training Load (fatigue, 7-day EW average). */
  atl: number;
  /** Chronic Training Load (fitness, 42-day EW average). */
  ctl: number;
  /** Training Stress Balance = CTL - ATL. */
  tsb: number;
  /** Raw daily load for that day. */
  dailyLoad: number;
}

export type TsbZone = 'fresh' | 'optimal' | 'fatigued' | 'overreaching';

/**
 * Classifies a TSB value into a training zone.
 * @returns TsbZone: fresh, optimal, fatigued, or overreaching.
 */
export function classifyTsb(tsb: number): TsbZone {
  if (tsb > 15) return 'fresh';
  if (tsb >= -10) return 'optimal';
  if (tsb >= -30) return 'fatigued';
  return 'overreaching';
}

/**
 * Aggregates sessions into daily loads, summing multiple sessions
 * on the same calendar day.
 * @returns Array of DailyLoad sorted by date ascending.
 */
export function aggregateDailyLoads(sessions: Session[]): DailyLoad[] {
  const byDate = new Map<string, number>();

  for (const s of sessions) {
    const date = s.timestamp.slice(0, 10);
    const load = estimateTrainingLoad(s);
    byDate.set(date, (byDate.get(date) ?? 0) + load);
  }

  return [...byDate.entries()]
    .map(([date, load]) => ({ date, load }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Computes the full TSB time series from an ordered list of daily loads.
 * @returns Array of TsbPoint with ATL, CTL, TSB for each day.
 *
 * Uses exponentially-weighted moving averages:
 *   EW_new = EW_prev + (load - EW_prev) * (1 - e^(-1/τ))
 *
 * Fills in zero-load days between sessions so the decay is continuous.
 */
export function computeTsbSeries(dailyLoads: DailyLoad[]): TsbPoint[] {
  if (dailyLoads.length === 0) return [];

  const atlDecay = 1 - Math.exp(-1 / ATL_TIME_CONSTANT);
  const ctlDecay = 1 - Math.exp(-1 / CTL_TIME_CONSTANT);

  // Fill in all dates from first to last load
  const firstDate = new Date(dailyLoads[0].date + 'T12:00:00');
  const lastDate = new Date(dailyLoads[dailyLoads.length - 1].date + 'T12:00:00');
  const totalDays = Math.round((lastDate.getTime() - firstDate.getTime()) / MS_PER_DAY) + 1;

  const loadMap = new Map(dailyLoads.map((d) => [d.date, d.load]));

  let atl = 0;
  let ctl = 0;
  const points: TsbPoint[] = [];

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(firstDate.getTime() + i * MS_PER_DAY);
    const date = d.toISOString().slice(0, 10);
    const load = loadMap.get(date) ?? 0;

    atl = atl + (load - atl) * atlDecay;
    ctl = ctl + (load - ctl) * ctlDecay;
    const tsb = ctl - atl;

    points.push({
      date,
      atl: Math.round(atl * 10) / 10,
      ctl: Math.round(ctl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10,
      dailyLoad: load,
    });
  }

  return points;
}

/**
 * Convenience: from sessions directly to TSB series.
 * @returns Array of TsbPoint.
 */
export function computeTsbFromSessions(sessions: Session[]): TsbPoint[] {
  const dailyLoads = aggregateDailyLoads(sessions);
  return computeTsbSeries(dailyLoads);
}

/**
 * Returns the latest TSB value, or null if no data.
 * @returns Latest TsbPoint or null.
 */
export function getLatestTsb(sessions: Session[]): TsbPoint | null {
  const series = computeTsbFromSessions(sessions);
  return series.length > 0 ? series[series.length - 1] : null;
}
