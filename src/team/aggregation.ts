/**
 * Team / group readiness aggregation.
 *
 * Privacy-first by design:
 *   - Only verdict + bucketed %baseline are ever exposed across the team.
 *   - Raw rMSSD, HR, and notes never leave the device.
 *   - K-anonymity gate (default k=3): aggregates are suppressed when
 *     fewer than k members published.
 *   - Member identity is opaque (UUID); display names are managed
 *     separately by the team owner.
 */
import { Session } from '../types';

export type ReadinessBucket = 'low' | 'medium' | 'high';

export interface TeamMemberPublication {
  memberId: string;
  date: string;
  verdict: 'go_hard' | 'moderate' | 'rest';
  bucket: ReadinessBucket;
  /** Bucketed %baseline rounded to nearest 5%. Never raw. */
  ratioPct: number;
  /** Optional public note ≤ 80 chars (no PII validation here). */
  note?: string;
}

export interface TeamAggregateRow {
  date: string;
  members: number;
  /** When < kAnonymityK, only this row is returned and the rest are nulled. */
  suppressed: boolean;
  goHard: number;
  moderate: number;
  rest: number;
  meanRatioPct: number | null;
}

export interface TeamSuggestion {
  /** Today's recommendation for the team based on aggregate readiness. */
  message: string;
  intensity: 'easy' | 'moderate' | 'hard' | 'rest';
}

const DEFAULT_K = 3;

/** Bucket a continuous %baseline into one of three labels. */
export function bucketRatio(ratioPct: number): ReadinessBucket {
  if (ratioPct >= 95) return 'high';
  if (ratioPct >= 80) return 'medium';
  return 'low';
}

/**
 * Convert a local Session to a publishable team payload (drops PII).
 * Returns null when the session has no verdict yet (insufficient baseline).
 */
export function buildPublication(
  session: Session,
  memberId: string,
  baselineMedian: number | null,
  publicNote?: string
): TeamMemberPublication | null {
  if (!session.verdict || baselineMedian === null || baselineMedian <= 0) return null;
  const ratio = (session.rmssd / baselineMedian) * 100;
  const ratioPct = Math.round(ratio / 5) * 5;
  const bucket = bucketRatio(ratioPct);
  const note = publicNote && publicNote.length > 80 ? publicNote.slice(0, 80) : publicNote;
  return {
    memberId,
    date: new Date(session.timestamp).toISOString().slice(0, 10),
    verdict: session.verdict,
    bucket,
    ratioPct,
    ...(note ? { note } : {}),
  };
}

/** Aggregate publications by date with k-anonymity enforcement. */
export function aggregateTeam(
  publications: TeamMemberPublication[],
  kAnonymityK: number = DEFAULT_K
): TeamAggregateRow[] {
  const byDate = new Map<string, TeamMemberPublication[]>();
  for (const p of publications) {
    const list = byDate.get(p.date) ?? [];
    list.push(p);
    byDate.set(p.date, list);
  }
  const rows: TeamAggregateRow[] = [];
  for (const [date, list] of byDate.entries()) {
    const goHard = list.filter((p) => p.verdict === 'go_hard').length;
    const moderate = list.filter((p) => p.verdict === 'moderate').length;
    const rest = list.filter((p) => p.verdict === 'rest').length;
    const suppressed = list.length < kAnonymityK;
    rows.push({
      date,
      members: list.length,
      suppressed,
      goHard: suppressed ? 0 : goHard,
      moderate: suppressed ? 0 : moderate,
      rest: suppressed ? 0 : rest,
      meanRatioPct: suppressed
        ? null
        : Math.round(list.reduce((acc, p) => acc + p.ratioPct, 0) / list.length),
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

/** Captain-facing suggestion derived from today's team aggregate. */
export function suggestTeamSession(today: TeamAggregateRow | undefined): TeamSuggestion {
  if (!today || today.suppressed) {
    return {
      message: 'Not enough teammates published yet to suggest a team session.',
      intensity: 'moderate',
    };
  }
  const total = today.goHard + today.moderate + today.rest;
  if (total === 0) {
    return { message: 'No verdicts available today.', intensity: 'moderate' };
  }
  const restRatio = today.rest / total;
  const hardRatio = today.goHard / total;
  if (restRatio >= 0.5) {
    return {
      message: `${today.rest}/${total} teammates are flagged Rest — keep today truly easy or off.`,
      intensity: 'rest',
    };
  }
  if (hardRatio >= 0.6) {
    return {
      message: `${today.goHard}/${total} teammates ready hard — green-light a key session.`,
      intensity: 'hard',
    };
  }
  if (hardRatio >= 0.3) {
    return {
      message: 'Mixed readiness — programme moderate-intensity, optional pull-out.',
      intensity: 'moderate',
    };
  }
  return {
    message: 'Most teammates ride moderate — endurance pace, no intervals.',
    intensity: 'easy',
  };
}
