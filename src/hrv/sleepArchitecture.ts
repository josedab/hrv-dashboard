/**
 * Sleep architecture analysis and hypnogram data preparation.
 *
 * Transforms raw sleep stage samples (from HealthKit / Health Connect)
 * into a structured hypnogram for visualization and correlation with
 * next-morning HRV readings.
 */

export type SleepStage = 'awake' | 'rem' | 'light' | 'deep';

export interface HypnogramSegment {
  stage: SleepStage;
  startMinute: number;
  endMinute: number;
  durationMinutes: number;
}

export interface SleepArchitecture {
  segments: HypnogramSegment[];
  totalMinutes: number;
  stageMinutes: Record<SleepStage, number>;
  stagePercent: Record<SleepStage, number>;
  /** Deep + REM as percentage of total (restorative sleep). */
  restorativePercent: number;
  sleepEfficiency: number;
  /** Number of wake episodes during the night. */
  wakeEpisodes: number;
}

export interface SleepHrvCorrelation {
  restorativePercent: number;
  nextMorningRmssd: number;
  insight: string;
}

const STAGE_MAP: Record<string, SleepStage> = {
  AWAKE: 'awake',
  INBED: 'awake',
  REM: 'rem',
  LIGHT: 'light',
  CORE: 'light',
  DEEP: 'deep',
};

/**
 * Normalizes a raw stage value into a canonical SleepStage.
 * @returns Canonical stage: 'awake', 'rem', 'light', or 'deep'. Defaults to 'light'.
 */
export function normalizeStage(raw: string): SleepStage {
  return STAGE_MAP[raw.toUpperCase()] ?? 'light';
}

interface RawSleepSample {
  value: string;
  startDate: string;
  endDate: string;
}

/**
 * Builds a hypnogram from raw sleep samples.
 * @returns SleepArchitecture or null if no valid sleep data.
 */
export function buildHypnogram(samples: RawSleepSample[]): SleepArchitecture | null {
  if (samples.length === 0) return null;

  const parsed = samples
    .map((s) => ({
      stage: normalizeStage(s.value),
      start: Date.parse(s.startDate),
      end: Date.parse(s.endDate),
    }))
    .filter((s) => !Number.isNaN(s.start) && !Number.isNaN(s.end) && s.end > s.start)
    .sort((a, b) => a.start - b.start);

  if (parsed.length === 0) return null;

  const epochStart = parsed[0].start;

  const segments: HypnogramSegment[] = parsed.map((s) => ({
    stage: s.stage,
    startMinute: Math.round((s.start - epochStart) / 60_000),
    endMinute: Math.round((s.end - epochStart) / 60_000),
    durationMinutes: Math.round((s.end - s.start) / 60_000),
  }));

  const stageMinutes: Record<SleepStage, number> = { awake: 0, rem: 0, light: 0, deep: 0 };
  for (const seg of segments) stageMinutes[seg.stage] += seg.durationMinutes;

  const totalMinutes = segments.reduce((s, seg) => s + seg.durationMinutes, 0);
  if (totalMinutes === 0) return null;

  const asleepMinutes = totalMinutes - stageMinutes.awake;
  const stagePercent: Record<SleepStage, number> = {
    awake: Math.round((stageMinutes.awake / totalMinutes) * 100),
    rem: Math.round((stageMinutes.rem / totalMinutes) * 100),
    light: Math.round((stageMinutes.light / totalMinutes) * 100),
    deep: Math.round((stageMinutes.deep / totalMinutes) * 100),
  };

  const restorativePercent =
    totalMinutes > 0
      ? Math.round(((stageMinutes.deep + stageMinutes.rem) / totalMinutes) * 100)
      : 0;

  const sleepEfficiency = totalMinutes > 0 ? Math.round((asleepMinutes / totalMinutes) * 100) : 0;

  const wakeEpisodes = segments.filter((s) => s.stage === 'awake').length;

  return {
    segments,
    totalMinutes,
    stageMinutes,
    stagePercent,
    restorativePercent,
    sleepEfficiency,
    wakeEpisodes,
  };
}

/**
 * Correlates sleep architecture with the next morning's HRV reading.
 * @returns SleepHrvCorrelation with restorative percent, rMSSD, and insight.
 */
export function correlateSleepHrv(
  architecture: SleepArchitecture,
  nextMorningRmssd: number,
  avgRmssd: number
): SleepHrvCorrelation {
  let insight: string;
  const rmssdPct = avgRmssd > 0 ? Math.round((nextMorningRmssd / avgRmssd) * 100) : 100;

  if (architecture.restorativePercent >= 40 && rmssdPct >= 95) {
    insight = 'Excellent restorative sleep is reflected in your strong HRV this morning.';
  } else if (architecture.restorativePercent < 25 && rmssdPct < 85) {
    insight = `Low restorative sleep (${architecture.restorativePercent}%) may be contributing to your lower HRV today.`;
  } else if (architecture.restorativePercent >= 35 && rmssdPct < 85) {
    insight =
      'Despite decent sleep architecture, your HRV is low — stress or training load may be the driver.';
  } else if (architecture.wakeEpisodes >= 3 && rmssdPct < 90) {
    insight = `${architecture.wakeEpisodes} wake episodes may have disrupted your recovery.`;
  } else {
    insight = 'Sleep and HRV are within normal ranges.';
  }

  return {
    restorativePercent: architecture.restorativePercent,
    nextMorningRmssd,
    insight,
  };
}
