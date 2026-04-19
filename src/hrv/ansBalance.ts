/**
 * Autonomic Nervous System (ANS) balance analysis.
 *
 * Interprets the LF/HF ratio from spectral analysis into clinically
 * meaningful zones representing sympathovagal balance. Tracks ANS
 * balance over time for the dashboard visualization.
 */
import { SpectralResult } from './spectral';
import { Session } from '../types';
import { computeSpectralMetrics } from './spectral';

export type AnsZone = 'parasympathetic' | 'balanced' | 'sympathetic' | 'high_sympathetic';

export interface AnsReading {
  date: string;
  lfHfRatio: number;
  zone: AnsZone;
  lfPercent: number;
  hfPercent: number;
  vlfPercent: number;
  totalPower: number;
  vlfReliable: boolean;
}

export interface AnsSummary {
  readings: AnsReading[];
  avgLfHfRatio: number;
  dominantZone: AnsZone;
  trendDirection: 'parasympathetic_shift' | 'stable' | 'sympathetic_shift';
  /** Percentage of readings in each zone. */
  zoneDistribution: Record<AnsZone, number>;
}

/** LF/HF ratio thresholds for ANS zone classification. */
const ANS_ZONE_THRESHOLDS = {
  parasympathetic: 0.5,
  balanced_upper: 2.0,
  sympathetic_upper: 4.0,
} as const;

/**
 * Classifies an LF/HF ratio into an ANS zone.
 * @returns AnsZone: parasympathetic, balanced, sympathetic, or high_sympathetic.
 */
export function classifyAnsZone(lfHfRatio: number): AnsZone {
  if (lfHfRatio < ANS_ZONE_THRESHOLDS.parasympathetic) return 'parasympathetic';
  if (lfHfRatio <= ANS_ZONE_THRESHOLDS.balanced_upper) return 'balanced';
  if (lfHfRatio <= ANS_ZONE_THRESHOLDS.sympathetic_upper) return 'sympathetic';
  return 'high_sympathetic';
}

/** Human-readable zone labels. */
export const ANS_ZONE_LABELS: Record<AnsZone, string> = {
  parasympathetic: 'Parasympathetic Dominant',
  balanced: 'Balanced',
  sympathetic: 'Sympathetic Dominant',
  high_sympathetic: 'High Sympathetic',
};

/** Zone colors for UI rendering. */
export const ANS_ZONE_COLORS: Record<AnsZone, string> = {
  parasympathetic: '#22C55E',
  balanced: '#3B82F6',
  sympathetic: '#F59E0B',
  high_sympathetic: '#EF4444',
};

/**
 * Converts a session with RR intervals into an ANS reading.
 * @returns AnsReading or null if insufficient data for spectral analysis.
 */
export function sessionToAnsReading(session: Session): AnsReading | null {
  if (session.rrIntervals.length < 60) return null;

  const spectral: SpectralResult = computeSpectralMetrics(session.rrIntervals);
  if (spectral.totalPower === 0) return null;

  return {
    date: session.timestamp.slice(0, 10),
    lfHfRatio: spectral.lfHfRatio,
    zone: classifyAnsZone(spectral.lfHfRatio),
    lfPercent: spectral.lf.percent,
    hfPercent: spectral.hf.percent,
    vlfPercent: spectral.vlf.percent,
    totalPower: spectral.totalPower,
    vlfReliable: spectral.vlfReliable,
  };
}

/**
 * Computes an ANS summary from a series of sessions.
 * @returns AnsSummary with readings, dominant zone, trend, and distribution.
 */
export function computeAnsSummary(sessions: Session[]): AnsSummary {
  const readings: AnsReading[] = [];
  for (const s of sessions) {
    const reading = sessionToAnsReading(s);
    if (reading) readings.push(reading);
  }

  if (readings.length === 0) {
    return {
      readings: [],
      avgLfHfRatio: 0,
      dominantZone: 'balanced',
      trendDirection: 'stable',
      zoneDistribution: { parasympathetic: 0, balanced: 0, sympathetic: 0, high_sympathetic: 0 },
    };
  }

  const avgLfHf = readings.reduce((s, r) => s + r.lfHfRatio, 0) / readings.length;

  const zoneCounts: Record<AnsZone, number> = {
    parasympathetic: 0,
    balanced: 0,
    sympathetic: 0,
    high_sympathetic: 0,
  };
  for (const r of readings) zoneCounts[r.zone]++;

  const zoneDistribution: Record<AnsZone, number> = {
    parasympathetic: Math.round((zoneCounts.parasympathetic / readings.length) * 100),
    balanced: Math.round((zoneCounts.balanced / readings.length) * 100),
    sympathetic: Math.round((zoneCounts.sympathetic / readings.length) * 100),
    high_sympathetic: Math.round((zoneCounts.high_sympathetic / readings.length) * 100),
  };

  const dominantZone = (Object.entries(zoneCounts) as [AnsZone, number][]).sort(
    (a, b) => b[1] - a[1]
  )[0][0];

  // Trend: compare first half vs second half LF/HF
  let trendDirection: AnsSummary['trendDirection'] = 'stable';
  if (readings.length >= 4) {
    const mid = Math.floor(readings.length / 2);
    const firstHalf = readings.slice(0, mid).reduce((s, r) => s + r.lfHfRatio, 0) / mid;
    const secondHalf =
      readings.slice(mid).reduce((s, r) => s + r.lfHfRatio, 0) / (readings.length - mid);
    const change = (secondHalf - firstHalf) / firstHalf;
    if (change > 0.15) trendDirection = 'sympathetic_shift';
    else if (change < -0.15) trendDirection = 'parasympathetic_shift';
  }

  return {
    readings,
    avgLfHfRatio: Math.round(avgLfHf * 100) / 100,
    dominantZone,
    trendDirection,
    zoneDistribution,
  };
}
