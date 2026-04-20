/**
 * Example: Compute HRV metrics from raw RR intervals.
 *
 * Demonstrates the core HRV computation pipeline:
 *   1. Artifact detection and filtering
 *   2. Metric computation (rMSSD, SDNN, mean HR, pNN50)
 *   3. Baseline comparison and verdict
 *
 * Run: npx ts-node examples/hrv-computation.ts
 */
import { computeHrvMetrics } from '../src/hrv/metrics';
import { filterArtifacts } from '../src/hrv/artifacts';
import { computeBaseline } from '../src/hrv/baseline';
import { computeVerdict } from '../src/hrv/verdict';

// Simulated 5-minute morning recording (~300 beats at ~60 bpm)
const rawRrIntervals = Array.from({ length: 300 }, (_, i) =>
  // Base interval ~1000ms with natural variability + one artifact
  i === 150 ? 400 : 1000 + 50 * Math.sin(i * 0.1) + (i % 7) * 3
);

console.log('=== HRV Computation Example ===\n');

// Step 1: Filter artifacts
const { cleanIntervals, artifactRate, artifacts } = filterArtifacts(rawRrIntervals);
const artifactCount = artifacts.filter(Boolean).length;
console.log(`Raw intervals: ${rawRrIntervals.length}`);
console.log(`Artifacts detected: ${artifactCount} (${(artifactRate * 100).toFixed(1)}%)`);
console.log(`Clean intervals: ${cleanIntervals.length}\n`);

// Step 2: Compute metrics
const metrics = computeHrvMetrics(rawRrIntervals);
console.log('HRV Metrics:');
console.log(`  rMSSD:     ${metrics.rmssd.toFixed(1)} ms`);
console.log(`  SDNN:      ${metrics.sdnn.toFixed(1)} ms`);
console.log(`  Mean HR:   ${metrics.meanHr.toFixed(1)} bpm`);
console.log(`  pNN50:     ${metrics.pnn50.toFixed(1)}%`);
console.log(`  Artifacts: ${(metrics.artifactRate * 100).toFixed(1)}%\n`);

// Step 3: Compare to baseline (simulated 7 days of prior readings)
const priorReadings = [
  { date: '2026-04-08', rmssd: 42, verdict: null as null },
  { date: '2026-04-09', rmssd: 38, verdict: null as null },
  { date: '2026-04-10', rmssd: 45, verdict: null as null },
  { date: '2026-04-11', rmssd: 40, verdict: null as null },
  { date: '2026-04-12', rmssd: 44, verdict: null as null },
  { date: '2026-04-13', rmssd: 36, verdict: null as null },
  { date: '2026-04-14', rmssd: 41, verdict: null as null },
];
const baseline = computeBaseline(priorReadings);
console.log(`Baseline: ${baseline.median.toFixed(1)} ms (${baseline.dayCount} days)\n`);

// Step 4: Determine verdict
const verdict = computeVerdict(metrics.rmssd, baseline);
const verdictEmoji = verdict === 'go_hard' ? '🟢' : verdict === 'moderate' ? '🟡' : '🔴';
console.log(`Verdict: ${verdictEmoji} ${verdict ?? 'insufficient baseline'}`);
const ratio = baseline.median > 0 ? ((metrics.rmssd / baseline.median) * 100).toFixed(0) : 'N/A';
console.log(`  (${ratio}% of baseline)`);
