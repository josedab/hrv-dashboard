/**
 * Integration test: full recording → verdict pipeline.
 *
 * Verifies the end-to-end flow from raw RR intervals through artifact
 * filtering, metrics computation, baseline comparison, verdict,
 * recovery score, coach narrative, and spectral analysis.
 * All modules are real (no mocks) — this validates the contracts
 * between modules hold for realistic input data.
 */
import { computeHrvMetrics } from '../../src/hrv/metrics';
import { filterArtifacts } from '../../src/hrv/artifacts';
import { computeBaseline } from '../../src/hrv/baseline';
import { computeVerdict, computeVerdictWithMode } from '../../src/hrv/verdict';
import { computeRecoveryScore } from '../../src/hrv/recovery';
import { generateNarrative, NarrativeContext } from '../../src/hrv/coachNarrative';
import { computeSpectralMetrics } from '../../src/hrv/spectral';
import { computeAnsSummary } from '../../src/hrv/ansBalance';
import { predictNextDay } from '../../src/hrv/prediction';
import { computeRmssdPercentile } from '../../src/hrv/norms';
import { processRecording } from '../../src/hooks/useRecordingOrchestrator';
import { Session, BaselineResult, DEFAULT_SETTINGS } from '../../src/types';

// Generate physiologically plausible RR intervals (~60 bpm with natural variability)
function generateRealisticRr(count: number, baseMs: number = 1000, seed: number = 42): number[] {
  const rr: number[] = [];
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const noise = (s / 0xffffffff - 0.5) * 100;
    const respiratory = 30 * Math.sin(2 * Math.PI * 0.1 * ((i * baseMs) / 1000));
    rr.push(Math.round(baseMs + noise + respiratory));
  }
  return rr;
}

function makeSession(daysAgo: number, rmssd: number, verdict: string | null = null): Session {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    id: `s-${daysAgo}`,
    timestamp: d.toISOString(),
    durationSeconds: 300,
    rrIntervals: generateRealisticRr(50),
    rmssd,
    sdnn: rmssd * 0.5,
    meanHr: 62,
    pnn50: 20,
    artifactRate: 0.02,
    verdict: verdict as Session['verdict'],
    perceivedReadiness: 3,
    trainingType: 'Strength',
    notes: null,
    sleepHours: 7.5,
    sleepQuality: 4,
    stressLevel: 2,
    source: 'chest_strap',
  };
}

describe('end-to-end: RR intervals → verdict → narrative', () => {
  const rawRr = generateRealisticRr(300);

  it('step 1: artifact filtering produces valid clean data', () => {
    const { cleanIntervals, artifactRate } = filterArtifacts(rawRr);
    expect(cleanIntervals.length).toBeGreaterThan(200);
    expect(artifactRate).toBeLessThan(0.2);
    expect(artifactRate).toBeGreaterThanOrEqual(0);
  });

  it('step 2: HRV metrics are physiologically plausible', () => {
    const metrics = computeHrvMetrics(rawRr);
    expect(metrics.rmssd).toBeGreaterThan(5);
    expect(metrics.rmssd).toBeLessThan(200);
    expect(metrics.sdnn).toBeGreaterThan(5);
    expect(metrics.meanHr).toBeGreaterThan(40);
    expect(metrics.meanHr).toBeLessThan(120);
    expect(metrics.pnn50).toBeGreaterThanOrEqual(0);
    expect(metrics.pnn50).toBeLessThanOrEqual(100);
  });

  it('step 3: baseline from 7 days produces valid median', () => {
    const readings = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (7 - i));
      return {
        date: d.toISOString().slice(0, 10),
        rmssd: 35 + i * 2,
        verdict: null as null,
      };
    });
    const baseline = computeBaseline(readings);
    expect(baseline.dayCount).toBe(7);
    expect(baseline.median).toBeGreaterThan(30);
    expect(baseline.median).toBeLessThan(55);
  });

  it('step 4: verdict is determined from metrics vs baseline', () => {
    const metrics = computeHrvMetrics(rawRr);
    const baseline: BaselineResult = {
      median: metrics.rmssd * 0.9,
      dayCount: 7,
      values: Array(7).fill(metrics.rmssd * 0.9),
    };
    const verdict = computeVerdict(metrics.rmssd, baseline);
    expect(verdict).toBe('go_hard');
  });

  it('step 5: recovery score combines HRV + subjective data', () => {
    const metrics = computeHrvMetrics(rawRr);
    const session = makeSession(0, metrics.rmssd);
    const baseline: BaselineResult = {
      median: metrics.rmssd,
      dayCount: 7,
      values: Array(7).fill(metrics.rmssd),
    };
    const recovery = computeRecoveryScore(session, baseline);
    expect(recovery).not.toBeNull();
    expect(recovery!.score).toBeGreaterThanOrEqual(0);
    expect(recovery!.score).toBeLessThanOrEqual(100);
    expect(['Excellent', 'Good', 'Fair', 'Poor']).toContain(recovery!.label);
  });

  it('step 6: coach narrative produces actionable text', () => {
    const metrics = computeHrvMetrics(rawRr);
    const baseline: BaselineResult = {
      median: metrics.rmssd,
      dayCount: 7,
      values: Array(7).fill(metrics.rmssd),
    };
    const recovery = computeRecoveryScore(makeSession(0, metrics.rmssd), baseline);
    const ctx: NarrativeContext = {
      currentRmssd: metrics.rmssd,
      baseline,
      verdict: 'go_hard',
      recovery,
      trendDirection: 'improving',
      trendPercent: 8,
      streak: 5,
      recentSessions: [makeSession(0, metrics.rmssd)],
    };
    const brief = generateNarrative(ctx);
    expect(brief.text.length).toBeGreaterThan(20);
    expect(brief.clauses.length).toBeGreaterThanOrEqual(1);
    expect(['🟢', '🟡', '🔴', '📊']).toContain(brief.emoji);
  });

  it('step 7: spectral analysis produces frequency-domain metrics', () => {
    const spectral = computeSpectralMetrics(rawRr);
    expect(spectral.totalPower).toBeGreaterThan(0);
    expect(spectral.lfHfRatio === null || spectral.lfHfRatio >= 0).toBe(true);
    expect(spectral.sampleCount).toBe(300);
    expect(spectral.lf.percent + spectral.hf.percent + spectral.vlf.percent).toBeGreaterThan(90);
  });

  it('step 8: ANS balance classifies the spectral result', () => {
    const sessions = Array.from({ length: 7 }, (_, i) => makeSession(i, 40 + i, 'go_hard'));
    sessions.forEach((s, idx) => {
      s.rrIntervals = generateRealisticRr(200, 900 + idx * 10);
    });
    const summary = computeAnsSummary(sessions);
    expect(summary.readings.length).toBeGreaterThanOrEqual(0);
    expect(['parasympathetic', 'balanced', 'sympathetic', 'high_sympathetic']).toContain(
      summary.dominantZone
    );
  });

  it('step 9: prediction uses pipeline output for forecasting', () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession(10 - i, 35 + i * 2, 'moderate')
    );
    const baseline: BaselineResult = { median: 42, dayCount: 7, values: Array(7).fill(42) };
    const prediction = predictNextDay(sessions, baseline);
    expect(prediction).not.toBeNull();
    expect(prediction!.predictedRmssd).toBeGreaterThan(0);
    expect(['go_hard', 'moderate', 'rest']).toContain(prediction!.likelyVerdict);
    expect(prediction!.rationale.length).toBeGreaterThan(10);
  });

  it('step 10: population benchmarking contextualizes the result', () => {
    const metrics = computeHrvMetrics(rawRr);
    const percentile = computeRmssdPercentile(metrics.rmssd, 35, 'male');
    expect(percentile).not.toBeNull();
    expect(percentile!.percentile).toBeGreaterThanOrEqual(1);
    expect(percentile!.percentile).toBeLessThanOrEqual(99);
    expect(percentile!.ageGroup).toBe('30–39');
  });

  it('full pipeline: processRecording wraps steps 1–2 correctly', () => {
    const result = processRecording(rawRr);
    expect(result.hasEnoughData).toBe(true);
    expect(result.metrics.rmssd).toBeGreaterThan(0);
    expect(result.artifactRate).toBeGreaterThanOrEqual(0);
    expect(result.cleanIntervals.length).toBeGreaterThan(0);
  });

  it('adaptive verdict mode works end-to-end', () => {
    const sessions = Array.from({ length: 40 }, (_, i) => makeSession(i, 30 + i * 0.5));
    const baseline: BaselineResult = { median: 42, dayCount: 7, values: Array(7).fill(42) };
    const settings = { ...DEFAULT_SETTINGS, verdictMode: 'adaptive' as const };
    const result = computeVerdictWithMode(45, baseline, settings, sessions);
    expect(result.verdict).not.toBeNull();
    expect(result.historyN).toBeGreaterThanOrEqual(30);
  });
});
