/**
 * Read last-night sleep from Apple HealthKit / Android Health Connect.
 *
 * Graduated from `experimental/integrations/sleepStrain.ts` once the
 * Log screen began auto-prefilling sleep duration from the platform
 * health store (see `healthAutoPull.ts`). The broader strain-fusion
 * code remains experimental.
 */
import { Platform } from 'react-native';
import { getHealthSdk, _resetHealthSdkCache } from './healthSdk';

/** Test-only reset hook for the cached SDK lookup. */
export function _resetHealthModuleCache(): void {
  _resetHealthSdkCache();
}

/** Last-night sleep summary derived from raw stage samples. */
export interface SleepSummary {
  hoursTotal: number;
  /** 1–5 quality estimate from the deep + REM share, when available. */
  qualityEstimate: number | null;
  /** ISO 8601 of bedtime start. */
  startedAt: string;
  /** ISO 8601 of wake time. */
  endedAt: string;
}

interface SleepRecord {
  value: string;
  startDate: string;
  endDate: string;
}

interface SleepStage {
  stage: string;
  startTime: string;
  endTime: string;
}

function mapStageValue(stage: string): string {
  switch (stage) {
    case 'DEEP':
      return 'DEEP';
    case 'REM':
      return 'REM';
    case 'LIGHT':
      return 'CORE';
    case 'AWAKE':
      return 'AWAKE';
    default:
      return 'INBED';
  }
}

/**
 * Reads last-night sleep from the platform health store. Returns null
 * when the SDK is not installed, permissions were denied, or no samples
 * fall in the last-18h window. Never throws.
 */
export async function readLastNightSleep(now: Date = new Date()): Promise<SleepSummary | null> {
  const health = getHealthSdk();
  if (!health) return null;

  const end = now;
  const start = new Date(end.getTime() - 18 * 3600_000);

  try {
    if (Platform.OS === 'ios') {
      const samples: SleepRecord[] = await new Promise((resolve, reject) => {
        health.getSleepSamples?.(
          { startDate: start.toISOString(), endDate: end.toISOString() },
          (err: Error | null, data: SleepRecord[] | null) =>
            err ? reject(err) : resolve(data ?? [])
        );
      });
      return summarizeSleep(samples);
    }

    if (Platform.OS === 'android') {
      const records = await health.readRecords?.('SleepSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });
      if (!records?.records?.length) return null;
      return summarizeSleep(
        records.records.flatMap(
          (r: { stages?: SleepStage[]; startTime: string; endTime: string }) =>
            (r.stages ?? []).map((stage) => ({
              value: mapStageValue(stage.stage),
              startDate: stage.startTime,
              endDate: stage.endTime,
            }))
        )
      );
    }
  } catch (err) {
    console.warn('[healthSleep] readLastNightSleep failed:', err);
  }
  return null;
}

export function summarizeSleep(samples: SleepRecord[]): SleepSummary | null {
  if (samples.length === 0) return null;

  const asleep = samples.filter((s) => s.value !== 'INBED' && s.value !== 'AWAKE');
  if (asleep.length === 0) return null;

  let totalMs = 0;
  let deepMs = 0;
  let remMs = 0;
  let earliest = Infinity;
  let latest = -Infinity;

  for (const s of asleep) {
    const start = Date.parse(s.startDate);
    const end = Date.parse(s.endDate);
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) continue;
    const ms = end - start;
    totalMs += ms;
    if (s.value === 'DEEP') deepMs += ms;
    if (s.value === 'REM') remMs += ms;
    if (start < earliest) earliest = start;
    if (end > latest) latest = end;
  }

  if (totalMs === 0) return null;

  const hoursTotal = totalMs / 3_600_000;
  const restorativeShare = (deepMs + remMs) / totalMs;
  const qualityEstimate =
    restorativeShare > 0 ? Math.max(1, Math.min(5, Math.round(restorativeShare * 10))) : null;

  return {
    hoursTotal: Math.round(hoursTotal * 10) / 10,
    qualityEstimate,
    startedAt: new Date(earliest).toISOString(),
    endedAt: new Date(latest).toISOString(),
  };
}
