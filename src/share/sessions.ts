/**
 * Session filtering for share bundles.
 */
import { Session } from '../types';

/**
 * Filters sessions to those within the last `lookbackDays` days.
 * Returns a new array; original input is not mutated.
 */
export function selectShareableSessions(sessions: Session[], lookbackDays: number): Session[] {
  if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) return [];
  const cutoff = Date.now() - lookbackDays * 86_400_000;
  return sessions.filter((s) => Date.parse(s.timestamp) >= cutoff);
}
