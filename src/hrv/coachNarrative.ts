/**
 * Template-based AI recovery coach narrative.
 *
 * Generates a personalized 2–3 sentence daily brief from the user's
 * HRV trend, baseline comparison, sleep correlation, training load,
 * and streak status. No LLM required — uses a clause-selection engine
 * with parameterized templates.
 *
 * Each narrative component is independently testable and the final
 * brief is assembled by combining the highest-priority clauses.
 */
import { Session, VerdictType, BaselineResult } from '../types';
import { RecoveryScore } from './recovery';

export interface NarrativeContext {
  currentRmssd: number;
  baseline: BaselineResult;
  verdict: VerdictType | null;
  recovery: RecoveryScore | null;
  /** Trend direction from weekly summary. */
  trendDirection: 'improving' | 'stable' | 'declining';
  trendPercent: number;
  /** Current consecutive-day streak. */
  streak: number;
  /** Recent sessions for pattern detection (last 7 days). */
  recentSessions: Session[];
}

export interface NarrativeBrief {
  /** The assembled 2–3 sentence narrative. */
  text: string;
  /** Individual clauses that composed the narrative. */
  clauses: string[];
  /** Emoji prefix for the brief. */
  emoji: string;
}

type ClauseGenerator = (ctx: NarrativeContext) => string | null;

/** Baseline ratio thresholds for narrative clause selection (percentages). */
const NARRATIVE_THRESHOLDS = {
  wellAbove: 110,
  atBaseline: 95,
  belowBaseline: 80,
  trendMinPct: 3,
  largeTrendPct: 15,
  minSleepHours: 6,
  greatSleepHours: 8,
} as const;

function baselineClause(ctx: NarrativeContext): string | null {
  if (!ctx.verdict || ctx.baseline.median === 0) return null;
  const pct = Math.round((ctx.currentRmssd / ctx.baseline.median) * 100);

  if (pct >= NARRATIVE_THRESHOLDS.wellAbove)
    return `Your HRV is ${pct - 100}% above your baseline — your nervous system is well-recovered.`;
  if (pct >= NARRATIVE_THRESHOLDS.atBaseline)
    return `Your HRV is right at your baseline — you're in a solid state for training.`;
  if (pct >= NARRATIVE_THRESHOLDS.belowBaseline)
    return `Your HRV is ${100 - pct}% below baseline — moderate intensity is appropriate today.`;
  return `Your HRV is ${100 - pct}% below baseline — your body is signaling a need for recovery.`;
}

function trendClause(ctx: NarrativeContext): string | null {
  if (!Number.isFinite(ctx.trendPercent)) return null;
  const absPct = Math.abs(Math.round(ctx.trendPercent));
  if (absPct < NARRATIVE_THRESHOLDS.trendMinPct) return null;

  if (ctx.trendDirection === 'improving') {
    if (absPct >= NARRATIVE_THRESHOLDS.largeTrendPct)
      return `Your HRV has jumped ${absPct}% over the past week — excellent adaptation.`;
    return `Your HRV is trending up ${absPct}% week-over-week.`;
  }
  if (ctx.trendDirection === 'declining') {
    if (absPct >= NARRATIVE_THRESHOLDS.largeTrendPct)
      return `Your HRV has dropped ${absPct}% this week — consider extra rest.`;
    return `Your HRV is trending down ${absPct}% — watch for overreaching signs.`;
  }
  return null;
}

function sleepClause(ctx: NarrativeContext): string | null {
  const latest = ctx.recentSessions[ctx.recentSessions.length - 1];
  if (!latest) return null;

  if (latest.sleepHours !== null && latest.sleepHours < NARRATIVE_THRESHOLDS.minSleepHours) {
    return `You logged only ${latest.sleepHours.toFixed(1)} hours of sleep — that may be suppressing your HRV.`;
  }
  if (latest.sleepHours !== null && latest.sleepHours >= NARRATIVE_THRESHOLDS.greatSleepHours) {
    return `Great sleep last night (${latest.sleepHours.toFixed(1)}h) — that's fueling your recovery.`;
  }
  if (latest.sleepQuality !== null && latest.sleepQuality <= 2) {
    return 'Poor sleep quality is likely impacting your readiness today.';
  }
  return null;
}

function streakClause(ctx: NarrativeContext): string | null {
  if (ctx.streak >= 14)
    return `Impressive — ${ctx.streak} consecutive days of tracking. Consistency is paying off.`;
  if (ctx.streak >= 7) return `${ctx.streak}-day streak! You're building a strong baseline.`;
  return null;
}

function trainingClause(ctx: NarrativeContext): string | null {
  const lastTwo = ctx.recentSessions.slice(-2);
  if (lastTwo.length < 2) return null;

  const bothRest = lastTwo.every((s) => s.trainingType === 'Rest' || !s.trainingType);
  if (bothRest && ctx.verdict === 'go_hard') {
    return 'Two rest days in a row have recharged you — today is ideal for a hard session.';
  }

  const bothHard = lastTwo.every((s) => s.trainingType && s.trainingType !== 'Rest');
  if (bothHard && ctx.verdict === 'rest') {
    return 'Back-to-back training days are showing up in your HRV — a rest day would help.';
  }

  return null;
}

function recoveryClause(ctx: NarrativeContext): string | null {
  if (!ctx.recovery) return null;
  if (ctx.recovery.score >= 85)
    return 'Your composite recovery score is excellent — all systems go.';
  if (ctx.recovery.score <= 35)
    return 'Your recovery score is low — prioritize sleep, hydration, and easy movement.';
  return null;
}

function verdictAction(ctx: NarrativeContext): string | null {
  switch (ctx.verdict) {
    case 'go_hard':
      return 'Push hard today — your body can handle it.';
    case 'moderate':
      return 'Train at moderate intensity — save the max effort for another day.';
    case 'rest':
      return 'Take it easy today — recovery work, stretching, or a walk.';
    default:
      return null;
  }
}

const CLAUSE_GENERATORS: ClauseGenerator[] = [
  baselineClause,
  trendClause,
  sleepClause,
  trainingClause,
  recoveryClause,
  streakClause,
];

function pickEmoji(verdict: VerdictType | null): string {
  switch (verdict) {
    case 'go_hard':
      return '🟢';
    case 'moderate':
      return '🟡';
    case 'rest':
      return '🔴';
    default:
      return '📊';
  }
}

/**
 * Generates a personalized daily recovery narrative from the user's
 * current HRV context.
 * @returns NarrativeBrief with text, clauses array, and emoji.
 */
export function generateNarrative(ctx: NarrativeContext): NarrativeBrief {
  const clauses: string[] = [];

  // Collect up to 2 contextual clauses
  for (const gen of CLAUSE_GENERATORS) {
    if (clauses.length >= 2) break;
    const clause = gen(ctx);
    if (clause) clauses.push(clause);
  }

  // Always end with an action clause
  const action = verdictAction(ctx);
  if (action) clauses.push(action);

  // Fallback for insufficient data
  if (clauses.length === 0) {
    return {
      text: 'Keep recording each morning to build your personal baseline. Consistency is key.',
      clauses: ['Keep recording each morning to build your personal baseline. Consistency is key.'],
      emoji: '📊',
    };
  }

  return {
    text: clauses.join(' '),
    clauses,
    emoji: pickEmoji(ctx.verdict),
  };
}
