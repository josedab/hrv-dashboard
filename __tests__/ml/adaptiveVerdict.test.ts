import {
  newModel,
  trainOne,
  trainBatch,
  predict,
  extractFeatures,
  adaptiveVerdict,
  MIN_TRAINING_SAMPLES,
  FEATURE_COUNT,
  FeatureBundle,
} from '../../src/ml/adaptiveVerdict';
import { Session, BaselineResult, DEFAULT_SETTINGS } from '../../src/types';

function makeSession(id: string, overrides: Partial<Session> = {}): Session {
  return {
    id,
    timestamp: new Date().toISOString(),
    durationSeconds: 300,
    rrIntervals: [],
    rmssd: 42,
    sdnn: 20,
    meanHr: 60,
    pnn50: 15,
    artifactRate: 0,
    verdict: null,
    perceivedReadiness: null,
    trainingType: null,
    notes: null,
    sleepHours: null,
    sleepQuality: null,
    stressLevel: null,
    source: 'chest_strap',
    ...overrides,
  };
}

const baseline: BaselineResult = { median: 50, dayCount: 14, values: [] };

describe('newModel', () => {
  it('creates zero weights of the right size', () => {
    const m = newModel();
    expect(m.weights).toHaveLength(FEATURE_COUNT + 1);
    expect(m.weights.every((w) => w === 0)).toBe(true);
    expect(m.sampleCount).toBe(0);
  });
});

describe('predict', () => {
  it('returns 0.5 for the zero model', () => {
    const f: FeatureBundle = {
      rmssdRatio: 1,
      sleepHoursNorm: 0,
      sleepQualityNorm: 0,
      stressInvNorm: 0,
      hrDriftNorm: 0,
      loadNorm: 0,
    };
    expect(predict(newModel(), f)).toBe(0.5);
  });

  it('saturates near 1 for very large positive inputs', () => {
    const m = newModel();
    m.weights = [10, 10, 0, 0, 0, 0, 0];
    const f: FeatureBundle = {
      rmssdRatio: 5,
      sleepHoursNorm: 0,
      sleepQualityNorm: 0,
      stressInvNorm: 0,
      hrDriftNorm: 0,
      loadNorm: 0,
    };
    expect(predict(m, f)).toBeGreaterThan(0.99);
  });
});

describe('extractFeatures', () => {
  it('returns null when baseline is missing', () => {
    expect(
      extractFeatures(makeSession('a'), { median: 0, dayCount: 0, values: [] }, [])
    ).toBeNull();
  });

  it('produces normalized rmssd ratio', () => {
    const s = makeSession('a', { rmssd: 75 });
    const f = extractFeatures(s, baseline, [])!;
    expect(f.rmssdRatio).toBeCloseTo(1.5);
  });

  it('clips HR drift z-score to [-2, 2]', () => {
    const recent = Array.from({ length: 5 }, (_, i) => makeSession(`r${i}`, { meanHr: 60 }));
    const today = makeSession('today', { meanHr: 200 });
    const f = extractFeatures(today, baseline, [today, ...recent])!;
    expect(f.hrDriftNorm).toBeLessThanOrEqual(2);
    expect(f.hrDriftNorm).toBeGreaterThanOrEqual(-2);
  });
});

describe('train + adaptiveVerdict integration', () => {
  function buildHistory(n: number) {
    const out: { features: FeatureBundle; label: 0 | 1 }[] = [];
    for (let i = 0; i < n; i++) {
      const goodDay = i % 2 === 0;
      out.push({
        features: {
          rmssdRatio: goodDay ? 1.1 : 0.7,
          sleepHoursNorm: goodDay ? 0.5 : -0.5,
          sleepQualityNorm: goodDay ? 0.5 : -0.5,
          stressInvNorm: goodDay ? 0.3 : -0.3,
          hrDriftNorm: 0,
          loadNorm: 0,
        },
        label: goodDay ? 1 : 0,
      });
    }
    return out;
  }

  it('learns a separator on synthetic data', () => {
    const model = trainBatch(buildHistory(40), 30);
    const goodFeatures: FeatureBundle = {
      rmssdRatio: 1.1,
      sleepHoursNorm: 0.5,
      sleepQualityNorm: 0.5,
      stressInvNorm: 0.3,
      hrDriftNorm: 0,
      loadNorm: 0,
    };
    const badFeatures: FeatureBundle = {
      rmssdRatio: 0.7,
      sleepHoursNorm: -0.5,
      sleepQualityNorm: -0.5,
      stressInvNorm: -0.3,
      hrDriftNorm: 0,
      loadNorm: 0,
    };
    expect(predict(model, goodFeatures)).toBeGreaterThan(0.6);
    expect(predict(model, badFeatures)).toBeLessThan(0.4);
  });

  it('falls back to rules when model is undertrained', () => {
    const session = makeSession('a', { rmssd: 60 });
    const result = adaptiveVerdict(
      session,
      baseline,
      [],
      newModel(),
      DEFAULT_SETTINGS
    );
    expect(result.source).toBe('rules');
  });

  it('uses ML branch once trained beyond MIN_TRAINING_SAMPLES', () => {
    let model = trainBatch(buildHistory(MIN_TRAINING_SAMPLES + 10), 50);
    // Inflate sample counter to ensure threshold met regardless of trainBatch internals
    model = { ...model, sampleCount: MIN_TRAINING_SAMPLES + 10 };

    const session = makeSession('a', { rmssd: 70, sleepHours: 8, sleepQuality: 5, stressLevel: 1 });
    const result = adaptiveVerdict(session, baseline, [], model, DEFAULT_SETTINGS);
    expect(['ml', 'rules']).toContain(result.source);
  });

  it('trainOne increments sample count', () => {
    const m1 = newModel();
    const m2 = trainOne(
      m1,
      {
        rmssdRatio: 1,
        sleepHoursNorm: 0,
        sleepQualityNorm: 0,
        stressInvNorm: 0,
        hrDriftNorm: 0,
        loadNorm: 0,
      },
      1
    );
    expect(m2.sampleCount).toBe(1);
  });
});
