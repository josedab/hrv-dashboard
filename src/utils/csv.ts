/** CSV export: converts Session arrays to a CSV string with headers and proper escaping. */
import { Session } from '../types';

/** Safely formats a number with toFixed, returning '0' for non-finite values. */
function safeFixed(value: number | null | undefined, digits: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '0';
  return value.toFixed(digits);
}

/**
 * Exports an array of sessions to CSV format.
 */
export function sessionsToCSV(sessions: Session[]): string {
  const headers = [
    'id',
    'timestamp',
    'duration_seconds',
    'rmssd',
    'sdnn',
    'mean_hr',
    'pnn50',
    'artifact_rate',
    'verdict',
    'perceived_readiness',
    'training_type',
    'notes',
    'rr_interval_count',
    'sleep_hours',
    'sleep_quality',
    'stress_level',
  ];

  const rows = sessions.map((s) => [
    s.id,
    s.timestamp,
    s.durationSeconds,
    safeFixed(s.rmssd, 2),
    safeFixed(s.sdnn, 2),
    safeFixed(s.meanHr, 1),
    safeFixed(s.pnn50, 1),
    safeFixed(s.artifactRate, 4),
    s.verdict ?? '',
    s.perceivedReadiness ?? '',
    s.trainingType ?? '',
    escapeCsvField(s.notes ?? ''),
    s.rrIntervals?.length ?? 0,
    s.sleepHours ?? '',
    s.sleepQuality ?? '',
    s.stressLevel ?? '',
  ]);

  const csvLines = [headers.join(','), ...rows.map((row) => row.join(','))];

  return csvLines.join('\n');
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
