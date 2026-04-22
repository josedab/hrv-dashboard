/**
 * Data-driven workout prescription table.
 *
 * Replaces duplicated verdict-branching logic in each sport function
 * with a declarative lookup table. New sports or verdicts are added
 * by extending the table — no conditional logic to modify.
 */
import { WorkoutBlock, WorkoutPrescription, IntensityZone, SportProfile } from './generator';
import { VerdictType } from '../types';

const ZONES: Record<string, IntensityZone> = {
  Z1: { label: 'Zone 1 — Recovery', intensity: { low: 0.5, high: 0.65 } },
  Z2: { label: 'Zone 2 — Aerobic', intensity: { low: 0.65, high: 0.78 } },
  Z3: { label: 'Zone 3 — Tempo', intensity: { low: 0.78, high: 0.87 } },
  Z4: { label: 'Zone 4 — Threshold', intensity: { low: 0.87, high: 0.95 } },
  Z5: { label: 'Zone 5 — VO2max', intensity: { low: 0.95, high: 1.1 } },
};

const DISCLAIMER =
  'This is a suggestion, not coaching. Adjust based on how you feel and consult a qualified professional for individualized programming.';

interface PrescriptionTemplate {
  headline: string;
  intensityStars: number;
  totalMinutes: number;
  blocks: WorkoutBlock[];
  rationale: string;
}

type VerdictKey = VerdictType | 'default';

/**
 * Prescription lookup table indexed by sport → verdict.
 * Each entry defines the complete workout template for that combination.
 */
const PRESCRIPTION_TABLE: Record<SportProfile, Record<VerdictKey, PrescriptionTemplate>> = {
  cycling: {
    go_hard: {
      headline: 'High intensity day',
      intensityStars: 5,
      totalMinutes: 50,
      blocks: [
        { durationSeconds: 600, zone: ZONES.Z2, description: 'Warm-up' },
        {
          durationSeconds: 240,
          zone: ZONES.Z5,
          reps: 5,
          description: '5×4min @ VO2max with 3min Z2 between',
        },
        { durationSeconds: 600, zone: ZONES.Z2, description: 'Cool-down' },
      ],
      rationale:
        'HRV is at or above your baseline — your nervous system is ready for a hard session.',
    },
    moderate: {
      headline: 'Tempo / Sweet-spot day',
      intensityStars: 3,
      totalMinutes: 60,
      blocks: [
        { durationSeconds: 600, zone: ZONES.Z2, description: 'Warm-up' },
        {
          durationSeconds: 600,
          zone: ZONES.Z3,
          reps: 3,
          description: '3×10min @ Tempo with 5min Z2 between',
        },
        { durationSeconds: 300, zone: ZONES.Z2, description: 'Cool-down' },
      ],
      rationale: 'HRV is moderate — train, but skip max efforts today.',
    },
    rest: {
      headline: 'Active recovery',
      intensityStars: 1,
      totalMinutes: 30,
      blocks: [
        { durationSeconds: 1800, zone: ZONES.Z1, description: 'Easy spin / jog at RPE ≤ 4' },
      ],
      rationale: 'HRV is suppressed — keep it short and easy to aid recovery.',
    },
    default: {
      headline: 'Build the baseline',
      intensityStars: 2,
      totalMinutes: 40,
      blocks: [{ durationSeconds: 2400, zone: ZONES.Z2, description: 'Endurance ride/run' }],
      rationale: 'Not enough data for a verdict yet — default to easy aerobic work.',
    },
  },

  running: {
    go_hard: {
      headline: 'High intensity day',
      intensityStars: 5,
      totalMinutes: 50,
      blocks: [
        { durationSeconds: 600, zone: ZONES.Z2, description: 'Warm-up' },
        {
          durationSeconds: 240,
          zone: ZONES.Z5,
          reps: 5,
          description: '5×4min @ VO2max with 3min Z2 between',
        },
        { durationSeconds: 600, zone: ZONES.Z2, description: 'Cool-down' },
      ],
      rationale:
        'HRV is at or above your baseline — your nervous system is ready for a hard session.',
    },
    moderate: {
      headline: 'Tempo / Sweet-spot day',
      intensityStars: 3,
      totalMinutes: 60,
      blocks: [
        { durationSeconds: 600, zone: ZONES.Z2, description: 'Warm-up' },
        {
          durationSeconds: 600,
          zone: ZONES.Z3,
          reps: 3,
          description: '3×10min @ Tempo with 5min Z2 between',
        },
        { durationSeconds: 300, zone: ZONES.Z2, description: 'Cool-down' },
      ],
      rationale: 'HRV is moderate — train, but skip max efforts today.',
    },
    rest: {
      headline: 'Active recovery',
      intensityStars: 1,
      totalMinutes: 30,
      blocks: [
        { durationSeconds: 1800, zone: ZONES.Z1, description: 'Easy spin / jog at RPE ≤ 4' },
      ],
      rationale: 'HRV is suppressed — keep it short and easy to aid recovery.',
    },
    default: {
      headline: 'Build the baseline',
      intensityStars: 2,
      totalMinutes: 40,
      blocks: [{ durationSeconds: 2400, zone: ZONES.Z2, description: 'Endurance ride/run' }],
      rationale: 'Not enough data for a verdict yet — default to easy aerobic work.',
    },
  },

  strength: {
    go_hard: {
      headline: 'Heavy day',
      intensityStars: 5,
      totalMinutes: 60,
      blocks: [
        { durationSeconds: 900, zone: ZONES.Z2, description: 'General warm-up' },
        { durationSeconds: 1800, zone: ZONES.Z4, description: 'Main lift: 5×3 @ 85–90% 1RM' },
        { durationSeconds: 900, zone: ZONES.Z3, description: 'Accessories: 3×8 @ 70%' },
      ],
      rationale: 'You are recovered — good day to push intensity on big lifts.',
    },
    moderate: {
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
    },
    rest: {
      headline: 'Mobility + light circuit',
      intensityStars: 1,
      totalMinutes: 25,
      blocks: [
        { durationSeconds: 900, zone: ZONES.Z1, description: 'Mobility flow' },
        { durationSeconds: 600, zone: ZONES.Z2, description: 'Bodyweight circuit @ RPE ≤ 5' },
      ],
      rationale: 'HRV is suppressed — prioritize tissue work, skip heavy loads.',
    },
    default: {
      headline: 'Foundation session',
      intensityStars: 2,
      totalMinutes: 40,
      blocks: [
        { durationSeconds: 900, zone: ZONES.Z2, description: 'Warm-up' },
        { durationSeconds: 1500, zone: ZONES.Z3, description: '3×10 @ 60% 1RM compound lifts' },
      ],
      rationale: 'Not enough HRV data yet — moderate full-body session.',
    },
  },

  bjj: {
    go_hard: {
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
    },
    moderate: {
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
    },
    rest: {
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
    },
    default: {
      headline: 'Open mat',
      intensityStars: 2,
      totalMinutes: 60,
      blocks: [
        { durationSeconds: 1200, zone: ZONES.Z2, description: 'Drilling' },
        { durationSeconds: 1800, zone: ZONES.Z3, description: 'Positional sparring' },
      ],
      rationale: 'No HRV verdict yet — default to a balanced session.',
    },
  },

  rest_day: {
    go_hard: {
      headline: 'Rest day',
      intensityStars: 0,
      totalMinutes: 0,
      blocks: [],
      rationale: 'Take the day off — sleep, hydrate, and eat well.',
    },
    moderate: {
      headline: 'Rest day',
      intensityStars: 0,
      totalMinutes: 0,
      blocks: [],
      rationale: 'Take the day off — sleep, hydrate, and eat well.',
    },
    rest: {
      headline: 'Rest day',
      intensityStars: 0,
      totalMinutes: 0,
      blocks: [],
      rationale: 'Take the day off — sleep, hydrate, and eat well.',
    },
    default: {
      headline: 'Rest day',
      intensityStars: 0,
      totalMinutes: 0,
      blocks: [],
      rationale: 'Take the day off — sleep, hydrate, and eat well.',
    },
  },
};

/**
 * Looks up the prescription template from the data table.
 * Falls back to 'default' when verdict is null or unrecognized.
 */
export function lookupPrescription(
  sport: SportProfile,
  verdict: VerdictType | null
): WorkoutPrescription {
  const sportTable = PRESCRIPTION_TABLE[sport];
  const template = (verdict && sportTable[verdict]) || sportTable.default;

  return {
    sport,
    verdict,
    headline: template.headline,
    intensityStars: template.intensityStars,
    totalMinutes: template.totalMinutes,
    blocks: [...template.blocks],
    rationale: template.rationale,
    disclaimer: DISCLAIMER,
  };
}
