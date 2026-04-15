export type VerdictType = 'go_hard' | 'moderate' | 'rest';

export interface Session {
  id: string;
  timestamp: string; // ISO 8601 UTC
  durationSeconds: number;
  rrIntervals: number[]; // milliseconds
  rmssd: number;
  sdnn: number;
  meanHr: number;
  pnn50: number;
  artifactRate: number;
  verdict: VerdictType | null; // null if insufficient baseline
  perceivedReadiness: number | null; // 1-5
  trainingType: string | null;
  notes: string | null;
}

export interface HrvMetrics {
  rmssd: number;
  sdnn: number;
  meanHr: number;
  pnn50: number;
  artifactRate: number;
}

export interface BaselineResult {
  median: number; // median rMSSD over window
  dayCount: number; // how many days have readings
  values: number[]; // daily rMSSD values used
}

export interface Settings {
  baselineWindowDays: number; // default 7
  goHardThreshold: number; // default 0.95
  moderateThreshold: number; // default 0.80
  pairedDeviceId: string | null;
  pairedDeviceName: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  baselineWindowDays: 7,
  goHardThreshold: 0.95,
  moderateThreshold: 0.80,
  pairedDeviceId: null,
  pairedDeviceName: null,
};

export interface DailyReading {
  date: string; // YYYY-MM-DD
  rmssd: number;
  verdict: VerdictType | null;
}
