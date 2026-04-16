import { Session } from '../types';

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
    s.rmssd.toFixed(2),
    s.sdnn.toFixed(2),
    s.meanHr.toFixed(1),
    s.pnn50.toFixed(1),
    s.artifactRate.toFixed(4),
    s.verdict ?? '',
    s.perceivedReadiness ?? '',
    s.trainingType ?? '',
    escapeCsvField(s.notes ?? ''),
    s.rrIntervals.length,
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
