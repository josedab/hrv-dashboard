/**
 * Browser-side backup loader.
 *
 * For the v1 skeleton this accepts an unencrypted JSON dump of the
 * sessions table (e.g. produced by Settings → Export JSON). The
 * encrypted .hrvbak path will plug in here once the WASM cipher port
 * lands; the surface stays the same.
 */
import { Session, VerdictType } from '@hrv/types';
import { buildDashboardSummary } from '@hrv/web/dashboard';

export interface AthleteSummary {
  id: string;
  name: string;
  totalSessions: number;
  currentStreakDays: number;
  baselineMedian: number;
  latestVerdict: VerdictType | null;
}

interface BackupBundle {
  athletes?: { id: string; name: string; sessions: Session[] }[];
  sessions?: Session[];
  athleteName?: string;
}

export async function loadBackup(text: string): Promise<AthleteSummary[]> {
  const bundle = JSON.parse(text) as BackupBundle;
  const groups =
    bundle.athletes ??
    (bundle.sessions
      ? [{ id: 'self', name: bundle.athleteName ?? 'Athlete', sessions: bundle.sessions }]
      : []);
  if (groups.length === 0) {
    throw new Error('Backup contained no sessions');
  }
  return groups.map((g) => {
    const summary = buildDashboardSummary(g.sessions);
    return {
      id: g.id,
      name: g.name,
      totalSessions: summary.totalSessions,
      currentStreakDays: summary.currentStreakDays,
      baselineMedian: summary.baseline.median,
      latestVerdict: summary.latestSession?.verdict ?? null,
    };
  });
}
