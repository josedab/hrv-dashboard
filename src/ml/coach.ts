/**
 * Rule-based AI training coach.
 *
 * Phase 1 (this module): deterministic, template-driven weekly brief
 * grounded in numerical features pulled from the existing analytics
 * pipeline. No model required; every claim cites the metric that
 * justified it. This is the safe default that ships in the app.
 *
 * Phase 2 (separate file, opt-in): user-supplied LLM API key. The
 * sanitized feature payload from {@link buildBriefFeatures} is sent to
 * the LLM along with the same template skeleton; the model only
 * paraphrases — it cannot invent numbers.
 */
import { Session } from '../types';
import { computeMedian } from '../hrv/baseline';
import { DEFAULT_SETTINGS } from '../types';

export interface BriefFeatures {
  sessions: number;
  windowDays: number;
  rmssdMean7: number | null;
  rmssdMean28: number | null;
  rmssdSlopePctPerWeek: number | null;
  baselineMedian: number | null;
  hardDays: number;
  moderateDays: number;
  restDays: number;
  artifactRateMean: number;
  meanHr: number | null;
  meanHr28: number | null;
  meanSleepHours: number | null;
  meanStress: number | null;
  longestStreak: number;
}

export interface CoachBrief {
  features: BriefFeatures;
  headline: string;
  bullets: string[];
  recommendation: string;
  /** Disclaimer required for any health-adjacent advice. */
  disclaimer: string;
}

const NOT_MEDICAL =
  'This brief is generated automatically from your sessions. It is not medical advice.';

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function within(session: Session, now: Date, days: number): boolean {
  const t = new Date(session.timestamp).getTime();
  return now.getTime() - t <= days * 24 * 60 * 60 * 1000;
}

/** Pure feature extraction; safe to send to a sandboxed LLM. */
export function buildBriefFeatures(
  sessions: Session[],
  now: Date = new Date(),
  windowDays: number = 7
): BriefFeatures {
  const window = sessions.filter((s) => within(s, now, windowDays));
  const month = sessions.filter((s) => within(s, now, 28));

  const rmssd7 = mean(window.map((s) => s.rmssd));
  const rmssd28 = mean(month.map((s) => s.rmssd));
  const slopePct =
    rmssd7 !== null && rmssd28 !== null && rmssd28 > 0
      ? ((rmssd7 - rmssd28) / rmssd28) * 100
      : null;

  const baselineWindow = sessions.filter((s) =>
    within(s, now, DEFAULT_SETTINGS.baselineWindowDays)
  );
  const baselineMedian = computeMedian(baselineWindow.map((s) => s.rmssd));

  const hardDays = window.filter((s) => s.verdict === 'go_hard').length;
  const moderateDays = window.filter((s) => s.verdict === 'moderate').length;
  const restDays = window.filter((s) => s.verdict === 'rest').length;

  const sleep = mean(
    window.map((s) => s.sleepHours).filter((v): v is number => v !== null && v !== undefined)
  );
  const stress = mean(
    window.map((s) => s.stressLevel).filter((v): v is number => v !== null && v !== undefined)
  );

  // Longest training streak in the window: consecutive days with a session.
  const dates = new Set(
    window.map((s) => new Date(s.timestamp).toISOString().slice(0, 10))
  );
  let longest = 0;
  let cur = 0;
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (dates.has(key)) {
      cur += 1;
      longest = Math.max(longest, cur);
    } else {
      cur = 0;
    }
  }

  return {
    sessions: window.length,
    windowDays,
    rmssdMean7: rmssd7,
    rmssdMean28: rmssd28,
    rmssdSlopePctPerWeek: slopePct,
    baselineMedian: baselineMedian > 0 ? baselineMedian : null,
    hardDays,
    moderateDays,
    restDays,
    artifactRateMean: mean(window.map((s) => s.artifactRate)) ?? 0,
    meanHr: mean(window.map((s) => s.meanHr)),
    meanHr28: mean(month.map((s) => s.meanHr)),
    meanSleepHours: sleep,
    meanStress: stress,
    longestStreak: longest,
  };
}

/** Deterministic brief generator. */
export function generateWeeklyBrief(
  sessions: Session[],
  now: Date = new Date()
): CoachBrief {
  const f = buildBriefFeatures(sessions, now);
  const bullets: string[] = [];

  if (f.sessions === 0) {
    return {
      features: f,
      headline: 'No readings this week',
      bullets: ['Take a reading first thing tomorrow morning to start your trend.'],
      recommendation: 'A 2–3 minute reading right after waking gives the cleanest baseline.',
      disclaimer: NOT_MEDICAL,
    };
  }

  // Trend
  if (f.rmssdSlopePctPerWeek !== null) {
    const dir = f.rmssdSlopePctPerWeek >= 0 ? 'up' : 'down';
    bullets.push(
      `rMSSD trending ${dir} ${Math.abs(f.rmssdSlopePctPerWeek).toFixed(1)}% vs your 28-day average.`
    );
  }

  // Verdict mix
  bullets.push(
    `Verdict mix: ${f.hardDays} hard, ${f.moderateDays} moderate, ${f.restDays} rest.`
  );

  // Sleep
  if (f.meanSleepHours !== null) {
    if (f.meanSleepHours < 7) {
      bullets.push(
        `Average sleep ${f.meanSleepHours.toFixed(1)}h is below the 7h threshold associated with steady HRV.`
      );
    } else {
      bullets.push(`Average sleep ${f.meanSleepHours.toFixed(1)}h is in a healthy range.`);
    }
  }

  // Stress
  if (f.meanStress !== null && f.meanStress >= 4) {
    bullets.push(`Self-reported stress is high (${f.meanStress.toFixed(1)}/5).`);
  }

  // HR drift
  if (f.meanHr !== null && f.meanHr28 !== null && f.meanHr - f.meanHr28 >= 4) {
    bullets.push(
      `Resting HR is ${(f.meanHr - f.meanHr28).toFixed(0)} bpm above the 28-day mean — possible accumulating fatigue or illness.`
    );
  }

  // Artifact / signal quality
  if (f.artifactRateMean > 0.05) {
    bullets.push(
      `Artifact rate ${(f.artifactRateMean * 100).toFixed(1)}% — re-fit the strap or moisten electrodes for cleaner signal.`
    );
  }

  // Recommendation logic
  let recommendation: string;
  if (f.restDays >= 3 || (f.rmssdSlopePctPerWeek !== null && f.rmssdSlopePctPerWeek <= -10)) {
    recommendation =
      'Plan an intentional easy week: 2 sessions of true Z2, one mobility/strength, two full days off.';
  } else if (f.hardDays >= 4) {
    recommendation =
      'You stacked a lot of hard days; insert a deload micro-cycle (3–4 easy days) before adding intensity.';
  } else if (f.rmssdSlopePctPerWeek !== null && f.rmssdSlopePctPerWeek >= 5) {
    recommendation =
      'Adaptation is positive — maintain the current load and add one structured interval session.';
  } else {
    recommendation =
      'Steady state — keep doing what you are doing and re-evaluate after 7 more readings.';
  }

  // Headline
  let headline: string;
  if (f.rmssdSlopePctPerWeek !== null && f.rmssdSlopePctPerWeek >= 5) {
    headline = 'You are adapting well';
  } else if (f.rmssdSlopePctPerWeek !== null && f.rmssdSlopePctPerWeek <= -10) {
    headline = 'Recovery is trending down';
  } else if (f.restDays >= 3) {
    headline = 'Body asking for rest';
  } else {
    headline = 'Steady week';
  }

  return {
    features: f,
    headline,
    bullets,
    recommendation,
    disclaimer: NOT_MEDICAL,
  };
}

export interface LlmCoachConfig {
  apiKey: string;
  model: string;
  endpoint?: string;
}

/**
 * Phase 2 plumbing stub. Sends only the numeric feature object + the
 * deterministic brief to the user-supplied LLM endpoint and asks it to
 * paraphrase. Network is injected for tests.
 */
export async function rewriteBriefWithLlm(
  brief: CoachBrief,
  config: LlmCoachConfig,
  fetchImpl: typeof fetch = (globalThis as { fetch: typeof fetch }).fetch
): Promise<CoachBrief> {
  if (!config.apiKey) throw new Error('LLM API key required');
  const endpoint = config.endpoint ?? 'https://api.openai.com/v1/chat/completions';
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'system',
          content:
            'You paraphrase HRV training briefs. NEVER invent numbers. Output JSON {headline, bullets[], recommendation}. Keep bullets ≤ 12 words each.',
        },
        {
          role: 'user',
          content: JSON.stringify({ features: brief.features, draft: brief }),
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) throw new Error(`LLM HTTP ${response.status}`);
  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content ?? '{}';
  let parsed: { headline?: string; bullets?: string[]; recommendation?: string } = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    return brief;
  }
  return {
    ...brief,
    headline: parsed.headline ?? brief.headline,
    bullets: Array.isArray(parsed.bullets) && parsed.bullets.length > 0 ? parsed.bullets : brief.bullets,
    recommendation: parsed.recommendation ?? brief.recommendation,
  };
}

/** Cited claim: each bullet has a machine-readable "evidence" payload. */
export interface CitedClaim {
  text: string;
  evidence: { metric: string; value: number | string; unit?: string }[];
}

export interface CitedBrief extends CoachBrief {
  citedBullets: CitedClaim[];
  citedRecommendation: CitedClaim;
}

/**
 * Same brief as {@link generateWeeklyBrief} but every claim carries the
 * exact metric and value that justified it. UI renders an expandable
 * "evidence" row under each bullet so the reader can audit the math.
 */
export function generateBriefWithCitations(
  sessions: Session[],
  now: Date = new Date()
): CitedBrief {
  const brief = generateWeeklyBrief(sessions, now);
  const f = brief.features;
  const cited: CitedClaim[] = [];

  if (f.rmssdSlopePctPerWeek !== null && f.rmssdMean7 !== null && f.rmssdMean28 !== null) {
    cited.push({
      text: `rMSSD trending ${f.rmssdSlopePctPerWeek >= 0 ? 'up' : 'down'} ${Math.abs(f.rmssdSlopePctPerWeek).toFixed(1)}% vs your 28-day average.`,
      evidence: [
        { metric: 'rmssdMean7', value: Number(f.rmssdMean7.toFixed(2)), unit: 'ms' },
        { metric: 'rmssdMean28', value: Number(f.rmssdMean28.toFixed(2)), unit: 'ms' },
        { metric: 'rmssdSlopePctPerWeek', value: Number(f.rmssdSlopePctPerWeek.toFixed(2)), unit: '%' },
      ],
    });
  }

  cited.push({
    text: `Verdict mix: ${f.hardDays} hard, ${f.moderateDays} moderate, ${f.restDays} rest.`,
    evidence: [
      { metric: 'hardDays', value: f.hardDays },
      { metric: 'moderateDays', value: f.moderateDays },
      { metric: 'restDays', value: f.restDays },
      { metric: 'sessions', value: f.sessions },
    ],
  });

  if (f.meanSleepHours !== null) {
    cited.push({
      text:
        f.meanSleepHours < 7
          ? `Average sleep ${f.meanSleepHours.toFixed(1)}h is below the 7h threshold associated with steady HRV.`
          : `Average sleep ${f.meanSleepHours.toFixed(1)}h is in a healthy range.`,
      evidence: [{ metric: 'meanSleepHours', value: Number(f.meanSleepHours.toFixed(2)), unit: 'h' }],
    });
  }

  if (f.meanStress !== null && f.meanStress >= 4) {
    cited.push({
      text: `Self-reported stress is high (${f.meanStress.toFixed(1)}/5).`,
      evidence: [{ metric: 'meanStress', value: Number(f.meanStress.toFixed(2)), unit: '1-5' }],
    });
  }

  if (f.meanHr !== null && f.meanHr28 !== null && f.meanHr - f.meanHr28 >= 4) {
    cited.push({
      text: `Resting HR is ${(f.meanHr - f.meanHr28).toFixed(0)} bpm above the 28-day mean.`,
      evidence: [
        { metric: 'meanHr', value: Number(f.meanHr.toFixed(1)), unit: 'bpm' },
        { metric: 'meanHr28', value: Number(f.meanHr28.toFixed(1)), unit: 'bpm' },
      ],
    });
  }

  if (f.artifactRateMean > 0.05) {
    cited.push({
      text: `Artifact rate ${(f.artifactRateMean * 100).toFixed(1)}% — re-fit the strap or moisten electrodes.`,
      evidence: [
        { metric: 'artifactRateMean', value: Number((f.artifactRateMean * 100).toFixed(2)), unit: '%' },
      ],
    });
  }

  const recEvidence: { metric: string; value: number | string; unit?: string }[] = [];
  if (f.rmssdSlopePctPerWeek !== null) {
    recEvidence.push({
      metric: 'rmssdSlopePctPerWeek',
      value: Number(f.rmssdSlopePctPerWeek.toFixed(2)),
      unit: '%',
    });
  }
  recEvidence.push({ metric: 'hardDays', value: f.hardDays });
  recEvidence.push({ metric: 'restDays', value: f.restDays });

  return {
    ...brief,
    citedBullets: cited,
    citedRecommendation: { text: brief.recommendation, evidence: recEvidence },
  };
}
