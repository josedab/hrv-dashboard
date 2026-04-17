/**
 * Adaptive ML readiness verdict.
 *
 * Uses on-device logistic regression with online SGD updates to personalize
 * verdict thresholds from a user's own history. Always runs alongside the
 * deterministic rule-based verdict and falls back to it whenever:
 *   - too few labeled training examples (< MIN_TRAINING_SAMPLES)
 *   - the model's confidence is below CONFIDENCE_FLOOR
 *   - features can't be extracted (missing baseline)
 *
 * The label signal is `perceivedReadiness >= 4` (binary good-day flag) which
 * the user provides via the LogScreen RPE slider.
 */
import { Session, BaselineResult, VerdictType, Settings, DEFAULT_SETTINGS } from '../types';
import { computeVerdict } from '../hrv/verdict';

export const MIN_TRAINING_SAMPLES = 14;
export const CONFIDENCE_FLOOR = 0.6;
export const FEATURE_COUNT = 6;

export interface AdaptiveModel {
  /** Length === FEATURE_COUNT + 1 (for bias). */
  weights: number[];
  /** Number of training samples seen. */
  sampleCount: number;
  /** Last update timestamp ISO 8601. */
  updatedAt: string;
}

export function newModel(): AdaptiveModel {
  return {
    weights: Array(FEATURE_COUNT + 1).fill(0),
    sampleCount: 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export interface FeatureBundle {
  /** rMSSD ratio vs baseline (typically 0.5–1.5). */
  rmssdRatio: number;
  /** Sleep hours normalized: (h - 7) / 2. */
  sleepHoursNorm: number;
  /** Sleep quality 1–5 normalized to -1..+1. */
  sleepQualityNorm: number;
  /** Stress level 1–5 normalized to -1..+1, sign inverted (high stress = -1). */
  stressInvNorm: number;
  /** Mean HR drift vs personal mean (z-score, clipped). */
  hrDriftNorm: number;
  /** Recent training-load 7d sum normalized: (load - 200) / 200. */
  loadNorm: number;
}

/** Extracts features from a session + recent history. Returns null if a required input is missing. */
export function extractFeatures(
  session: Session,
  baseline: BaselineResult,
  recentSessions: Session[]
): FeatureBundle | null {
  if (baseline.median <= 0) return null;
  const rmssdRatio = session.rmssd / baseline.median;

  const sleepHoursNorm = session.sleepHours !== null ? (session.sleepHours - 7) / 2 : 0;
  const sleepQualityNorm =
    session.sleepQuality !== null ? (session.sleepQuality - 3) / 2 : 0;
  const stressInvNorm = session.stressLevel !== null ? -((session.stressLevel - 3) / 2) : 0;

  const hrSamples = recentSessions
    .filter((s) => s.id !== session.id)
    .slice(0, 14)
    .map((s) => s.meanHr);
  const meanHr =
    hrSamples.length > 0 ? hrSamples.reduce((a, b) => a + b, 0) / hrSamples.length : session.meanHr;
  const stdHr =
    hrSamples.length > 1
      ? Math.sqrt(
          hrSamples.reduce((s, v) => s + (v - meanHr) ** 2, 0) / hrSamples.length
        )
      : 1;
  const hrDriftZ = stdHr > 0 ? (session.meanHr - meanHr) / stdHr : 0;
  const hrDriftNorm = Math.max(-2, Math.min(2, hrDriftZ));

  const loadCutoff = Date.parse(session.timestamp) - 7 * 86_400_000;
  const recentLoad = recentSessions
    .filter((s) => Date.parse(s.timestamp) >= loadCutoff && s.id !== session.id)
    .reduce((sum, s) => sum + (estimateLoad(s) ?? 0), 0);
  const loadNorm = (recentLoad - 200) / 200;

  return {
    rmssdRatio,
    sleepHoursNorm,
    sleepQualityNorm,
    stressInvNorm,
    hrDriftNorm,
    loadNorm,
  };
}

function estimateLoad(s: Session): number | null {
  if (!s.trainingType) return null;
  const intensity: Record<string, number> = {
    Strength: 7,
    BJJ: 8,
    Cycling: 6,
    Rest: 1,
    Other: 5,
  };
  const base = intensity[s.trainingType] ?? 5;
  const effort = s.perceivedReadiness !== null ? 0.6 + (s.perceivedReadiness / 5) * 0.8 : 1;
  return base * effort * 10;
}

function featuresToVector(f: FeatureBundle): number[] {
  return [
    1, // bias
    f.rmssdRatio,
    f.sleepHoursNorm,
    f.sleepQualityNorm,
    f.stressInvNorm,
    f.hrDriftNorm,
    f.loadNorm,
  ];
}

function sigmoid(z: number): number {
  if (z > 35) return 1;
  if (z < -35) return 0;
  return 1 / (1 + Math.exp(-z));
}

/** Predicts P(good day | features) ∈ [0, 1]. */
export function predict(model: AdaptiveModel, features: FeatureBundle): number {
  const x = featuresToVector(features);
  let z = 0;
  for (let i = 0; i < x.length; i++) z += model.weights[i] * x[i];
  return sigmoid(z);
}

/**
 * Performs one online SGD update with logistic loss + L2 regularization.
 * Returns a new model object (immutable update).
 */
export function trainOne(
  model: AdaptiveModel,
  features: FeatureBundle,
  label: 0 | 1,
  lr: number = 0.05,
  l2: number = 0.001
): AdaptiveModel {
  const x = featuresToVector(features);
  const yhat = predict(model, features);
  const err = yhat - label;
  const weights = model.weights.map((w, i) => w - lr * (err * x[i] + l2 * w));
  return {
    weights,
    sampleCount: model.sampleCount + 1,
    updatedAt: new Date().toISOString(),
  };
}

/** Trains the model from scratch over a labeled history. */
export function trainBatch(
  history: { features: FeatureBundle; label: 0 | 1 }[],
  epochs: number = 20
): AdaptiveModel {
  let model = newModel();
  for (let e = 0; e < epochs; e++) {
    for (const sample of history) {
      model = trainOne(model, sample.features, sample.label);
    }
  }
  return model;
}

export interface AdaptiveVerdictResult {
  verdict: VerdictType | null;
  /** Whether the verdict came from the ML model (true) or rule-based fallback (false). */
  source: 'ml' | 'rules';
  /** ML probability, present when source === 'ml'. */
  probability?: number;
  explanation: string[];
}

/**
 * Returns the adaptive verdict, with explainable reasons. Always returns a
 * rule-based verdict if conditions for ML use aren't met.
 */
export function adaptiveVerdict(
  session: Session,
  baseline: BaselineResult,
  recentSessions: Session[],
  model: AdaptiveModel,
  settings: Settings = DEFAULT_SETTINGS
): AdaptiveVerdictResult {
  const ruleVerdict = computeVerdict(session.rmssd, baseline, settings);
  const features = extractFeatures(session, baseline, recentSessions);

  const explanation: string[] = [];

  if (baseline.median > 0) {
    const ratio = session.rmssd / baseline.median;
    explanation.push(`rMSSD is ${(ratio * 100).toFixed(0)}% of your baseline`);
  }
  if (session.sleepHours !== null) {
    explanation.push(`Slept ${session.sleepHours.toFixed(1)}h`);
  }
  if (session.stressLevel !== null && session.stressLevel >= 4) {
    explanation.push(`High self-reported stress (${session.stressLevel}/5)`);
  }

  if (model.sampleCount < MIN_TRAINING_SAMPLES || !features) {
    return { verdict: ruleVerdict, source: 'rules', explanation };
  }

  const probability = predict(model, features);
  const confidence = Math.abs(probability - 0.5) * 2; // 0..1
  if (confidence < CONFIDENCE_FLOOR) {
    return { verdict: ruleVerdict, source: 'rules', probability, explanation };
  }

  let mlVerdict: VerdictType;
  if (probability >= 0.75) mlVerdict = 'go_hard';
  else if (probability >= 0.45) mlVerdict = 'moderate';
  else mlVerdict = 'rest';

  if (mlVerdict !== ruleVerdict) {
    explanation.push(
      `Adaptive model overrides the rule-based verdict (${ruleVerdict ?? 'none'} → ${mlVerdict})`
    );
  }

  return { verdict: mlVerdict, source: 'ml', probability, explanation };
}
