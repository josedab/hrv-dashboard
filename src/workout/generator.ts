/**
 * Workout-of-the-day generator.
 *
 * Maps the readiness verdict + sport profile to a concrete prescription
 * with duration, intensity zones, and structured intervals. Designed to
 * be exported to .fit/.zwo for Garmin/Strava in a follow-up phase.
 */
import { Session, VerdictType } from '../types';
import { lookupPrescription } from './prescriptions';

export type SportProfile = 'cycling' | 'running' | 'strength' | 'bjj' | 'rest_day';

/** Power/HR zone description for endurance prescriptions. */
export interface IntensityZone {
  /** "Zone 2" / "VO2max" / etc. */
  label: string;
  /** Lower & upper bound as fraction of LTHR/FTP. */
  intensity: { low: number; high: number };
}

export interface WorkoutBlock {
  durationSeconds: number;
  zone: IntensityZone;
  /** Optional reps for interval blocks; 1 = continuous. */
  reps?: number;
  description: string;
}

export interface WorkoutPrescription {
  sport: SportProfile;
  verdict: VerdictType | null;
  /** Short headline shown in the UI. */
  headline: string;
  /** 1–5 stars, derived from verdict + sport. */
  intensityStars: number;
  /** Estimated total duration in minutes. */
  totalMinutes: number;
  blocks: WorkoutBlock[];
  /** Plain-text rationale shown to the user. */
  rationale: string;
  disclaimer: string;
}

export interface GenerateOptions {
  sport: SportProfile;
  /** Today's session if available; verdict is read from it. */
  session?: Session | null;
  /** Override the verdict directly; takes precedence over session.verdict. */
  verdict?: VerdictType | null;
}

/** Top-level generator entry point. Uses data-driven prescription lookup. */
export function generateWorkout(opts: GenerateOptions): WorkoutPrescription {
  const verdict = opts.verdict !== undefined ? opts.verdict : (opts.session?.verdict ?? null);
  return lookupPrescription(opts.sport, verdict);
}

/**
 * Produces a Zwift-compatible structured workout (.zwo XML).
 * Power values are expressed as fractions of FTP.
 */
export function toZwoXml(workout: WorkoutPrescription, athleteName: string = 'Athlete'): string {
  const blocks = workout.blocks
    .map((block) => {
      const reps = block.reps ?? 1;
      const power = ((block.zone.intensity.low + block.zone.intensity.high) / 2).toFixed(2);
      if (reps > 1) {
        return `    <IntervalsT Repeat="${reps}" OnDuration="${block.durationSeconds}" OffDuration="180" OnPower="${power}" OffPower="0.55"/>`;
      }
      return `    <SteadyState Duration="${block.durationSeconds}" Power="${power}"/>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>${escapeXml(athleteName)}</author>
  <name>${escapeXml(workout.headline)}</name>
  <description>${escapeXml(workout.rationale)}</description>
  <sportType>${workout.sport === 'running' ? 'run' : 'bike'}</sportType>
  <workout>
${blocks}
  </workout>
</workout_file>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
