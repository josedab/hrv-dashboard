/**
 * Workout-of-the-day generator.
 *
 * Maps the readiness verdict + sport profile to a concrete prescription
 * with duration, intensity zones, and structured intervals. Designed to
 * be exported to .fit/.zwo for Garmin/Strava in a follow-up phase.
 */
import { Session, VerdictType } from '../types';

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

const DISCLAIMER =
  'This is a suggestion, not coaching. Adjust based on how you feel and consult a qualified professional for individualized programming.';

const ZONES: Record<string, IntensityZone> = {
  Z1: { label: 'Zone 1 — Recovery', intensity: { low: 0.5, high: 0.65 } },
  Z2: { label: 'Zone 2 — Aerobic', intensity: { low: 0.65, high: 0.78 } },
  Z3: { label: 'Zone 3 — Tempo', intensity: { low: 0.78, high: 0.87 } },
  Z4: { label: 'Zone 4 — Threshold', intensity: { low: 0.87, high: 0.95 } },
  Z5: { label: 'Zone 5 — VO2max', intensity: { low: 0.95, high: 1.1 } },
};

function buildEnduranceWorkout(
  sport: 'cycling' | 'running',
  verdict: VerdictType | null
): WorkoutPrescription {
  if (verdict === 'go_hard') {
    const blocks: WorkoutBlock[] = [
      { durationSeconds: 600, zone: ZONES.Z2, description: 'Warm-up' },
      {
        durationSeconds: 240,
        zone: ZONES.Z5,
        reps: 5,
        description: '5×4min @ VO2max with 3min Z2 between',
      },
      { durationSeconds: 600, zone: ZONES.Z2, description: 'Cool-down' },
    ];
    return {
      sport,
      verdict,
      headline: 'High intensity day',
      intensityStars: 5,
      totalMinutes: 50,
      blocks,
      rationale:
        'HRV is at or above your baseline — your nervous system is ready for a hard session.',
      disclaimer: DISCLAIMER,
    };
  }

  if (verdict === 'moderate') {
    const blocks: WorkoutBlock[] = [
      { durationSeconds: 600, zone: ZONES.Z2, description: 'Warm-up' },
      {
        durationSeconds: 600,
        zone: ZONES.Z3,
        reps: 3,
        description: '3×10min @ Tempo with 5min Z2 between',
      },
      { durationSeconds: 300, zone: ZONES.Z2, description: 'Cool-down' },
    ];
    return {
      sport,
      verdict,
      headline: 'Tempo / Sweet-spot day',
      intensityStars: 3,
      totalMinutes: 60,
      blocks,
      rationale: 'HRV is moderate — train, but skip max efforts today.',
      disclaimer: DISCLAIMER,
    };
  }

  if (verdict === 'rest') {
    const blocks: WorkoutBlock[] = [
      { durationSeconds: 1800, zone: ZONES.Z1, description: 'Easy spin / jog at RPE ≤ 4' },
    ];
    return {
      sport,
      verdict,
      headline: 'Active recovery',
      intensityStars: 1,
      totalMinutes: 30,
      blocks,
      rationale: 'HRV is suppressed — keep it short and easy to aid recovery.',
      disclaimer: DISCLAIMER,
    };
  }

  // Unknown / building baseline
  const blocks: WorkoutBlock[] = [
    { durationSeconds: 2400, zone: ZONES.Z2, description: 'Endurance ride/run' },
  ];
  return {
    sport,
    verdict,
    headline: 'Build the baseline',
    intensityStars: 2,
    totalMinutes: 40,
    blocks,
    rationale: 'Not enough data for a verdict yet — default to easy aerobic work.',
    disclaimer: DISCLAIMER,
  };
}

function buildStrengthWorkout(verdict: VerdictType | null): WorkoutPrescription {
  if (verdict === 'go_hard') {
    return {
      sport: 'strength',
      verdict,
      headline: 'Heavy day',
      intensityStars: 5,
      totalMinutes: 60,
      blocks: [
        { durationSeconds: 900, zone: ZONES.Z2, description: 'General warm-up' },
        {
          durationSeconds: 1800,
          zone: ZONES.Z4,
          description: 'Main lift: 5×3 @ 85–90% 1RM',
        },
        {
          durationSeconds: 900,
          zone: ZONES.Z3,
          description: 'Accessories: 3×8 @ 70%',
        },
      ],
      rationale: 'You are recovered — good day to push intensity on big lifts.',
      disclaimer: DISCLAIMER,
    };
  }

  if (verdict === 'moderate') {
    return {
      sport: 'strength',
      verdict,
      headline: 'Volume / technique day',
      intensityStars: 3,
      totalMinutes: 50,
      blocks: [
        { durationSeconds: 900, zone: ZONES.Z2, description: 'Warm-up' },
        {
          durationSeconds: 1800,
          zone: ZONES.Z3,
          description: '4×6 @ 70–75% 1RM, focus on execution',
        },
      ],
      rationale: 'HRV is moderate — drop the top-end load and bank quality reps.',
      disclaimer: DISCLAIMER,
    };
  }

  if (verdict === 'rest') {
    return {
      sport: 'strength',
      verdict,
      headline: 'Mobility + light circuit',
      intensityStars: 1,
      totalMinutes: 25,
      blocks: [
        { durationSeconds: 900, zone: ZONES.Z1, description: 'Mobility flow' },
        {
          durationSeconds: 600,
          zone: ZONES.Z2,
          description: 'Bodyweight circuit @ RPE ≤ 5',
        },
      ],
      rationale: 'HRV is suppressed — prioritize tissue work, skip heavy loads.',
      disclaimer: DISCLAIMER,
    };
  }

  return {
    sport: 'strength',
    verdict,
    headline: 'Foundation session',
    intensityStars: 2,
    totalMinutes: 40,
    blocks: [
      { durationSeconds: 900, zone: ZONES.Z2, description: 'Warm-up' },
      {
        durationSeconds: 1500,
        zone: ZONES.Z3,
        description: '3×10 @ 60% 1RM compound lifts',
      },
    ],
    rationale: 'Not enough HRV data yet — moderate full-body session.',
    disclaimer: DISCLAIMER,
  };
}

function buildBjjWorkout(verdict: VerdictType | null): WorkoutPrescription {
  if (verdict === 'go_hard') {
    return {
      sport: 'bjj',
      verdict,
      headline: 'Hard rolls',
      intensityStars: 5,
      totalMinutes: 90,
      blocks: [
        { durationSeconds: 600, zone: ZONES.Z2, description: 'Warm-up + drilling' },
        {
          durationSeconds: 360,
          zone: ZONES.Z5,
          reps: 5,
          description: '5×6min live rolls with 60s rest',
        },
      ],
      rationale: 'Recovery looks good — go full intensity in live training.',
      disclaimer: DISCLAIMER,
    };
  }

  if (verdict === 'moderate') {
    return {
      sport: 'bjj',
      verdict,
      headline: 'Technique + flow rolling',
      intensityStars: 3,
      totalMinutes: 60,
      blocks: [
        { durationSeconds: 1200, zone: ZONES.Z2, description: 'Drilling' },
        {
          durationSeconds: 360,
          zone: ZONES.Z3,
          reps: 3,
          description: '3×6min flow rolls @ 60–70%',
        },
      ],
      rationale: 'Moderate readiness — drill heavy and roll light.',
      disclaimer: DISCLAIMER,
    };
  }

  if (verdict === 'rest') {
    return {
      sport: 'bjj',
      verdict,
      headline: 'Active recovery / off the mats',
      intensityStars: 1,
      totalMinutes: 30,
      blocks: [
        {
          durationSeconds: 1800,
          zone: ZONES.Z1,
          description: 'Solo movement + mobility, skip live rolls',
        },
      ],
      rationale: 'HRV is suppressed — recovery > training today.',
      disclaimer: DISCLAIMER,
    };
  }

  return {
    sport: 'bjj',
    verdict,
    headline: 'Open mat',
    intensityStars: 2,
    totalMinutes: 60,
    blocks: [
      { durationSeconds: 1200, zone: ZONES.Z2, description: 'Drilling' },
      { durationSeconds: 1800, zone: ZONES.Z3, description: 'Positional sparring' },
    ],
    rationale: 'No HRV verdict yet — default to a balanced session.',
    disclaimer: DISCLAIMER,
  };
}

function buildRestDay(): WorkoutPrescription {
  return {
    sport: 'rest_day',
    verdict: 'rest',
    headline: 'Rest day',
    intensityStars: 0,
    totalMinutes: 0,
    blocks: [],
    rationale: 'Take the day off — sleep, hydrate, and eat well.',
    disclaimer: DISCLAIMER,
  };
}

export interface GenerateOptions {
  sport: SportProfile;
  /** Today's session if available; verdict is read from it. */
  session?: Session | null;
  /** Override the verdict directly; takes precedence over session.verdict. */
  verdict?: VerdictType | null;
}

/** Top-level generator entry point. */
export function generateWorkout(opts: GenerateOptions): WorkoutPrescription {
  const verdict = opts.verdict !== undefined ? opts.verdict : (opts.session?.verdict ?? null);
  switch (opts.sport) {
    case 'cycling':
    case 'running':
      return buildEnduranceWorkout(opts.sport, verdict);
    case 'strength':
      return buildStrengthWorkout(verdict);
    case 'bjj':
      return buildBjjWorkout(verdict);
    case 'rest_day':
      return buildRestDay();
  }
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
