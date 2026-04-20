/**
 * Example: Frequency-domain HRV spectral analysis.
 *
 * Demonstrates computing LF/HF/VLF band powers and the LF/HF ratio
 * from RR intervals using Goertzel spectral analysis.
 *
 * Run: npx ts-node examples/spectral-analysis.ts
 */
import { computeSpectralMetrics } from '../src/hrv/spectral';

// Generate a sinusoidal RR signal at 0.1 Hz (resonance breathing, ~6 brpm)
function generateRr(baseMs: number, amplitudeMs: number, freqHz: number, count: number): number[] {
  const rr: number[] = [];
  let t = 0;
  for (let i = 0; i < count; i++) {
    const interval = baseMs + amplitudeMs * Math.sin(2 * Math.PI * freqHz * t);
    rr.push(interval);
    t += interval / 1000;
  }
  return rr;
}

console.log('=== Spectral Analysis Example ===\n');

// Scenario 1: Resonance breathing (0.1 Hz → strong LF)
const resonanceRr = generateRr(900, 60, 0.1, 300);
const resonance = computeSpectralMetrics(resonanceRr);

console.log('Scenario 1: Resonance breathing (6 brpm)');
console.log(
  `  VLF: ${resonance.vlf.percent.toFixed(1)}% (peak ${resonance.vlf.peakHz ?? 'N/A'} Hz)`
);
console.log(`  LF:  ${resonance.lf.percent.toFixed(1)}% (peak ${resonance.lf.peakHz ?? 'N/A'} Hz)`);
console.log(`  HF:  ${resonance.hf.percent.toFixed(1)}% (peak ${resonance.hf.peakHz ?? 'N/A'} Hz)`);
console.log(`  LF/HF ratio: ${resonance.lfHfRatio}`);
console.log(`  Total power: ${resonance.totalPower}\n`);

// Scenario 2: Normal breathing (0.25 Hz → strong HF)
const normalRr = generateRr(800, 40, 0.25, 300);
const normal = computeSpectralMetrics(normalRr);

console.log('Scenario 2: Normal breathing (15 brpm)');
console.log(`  VLF: ${normal.vlf.percent.toFixed(1)}% (peak ${normal.vlf.peakHz ?? 'N/A'} Hz)`);
console.log(`  LF:  ${normal.lf.percent.toFixed(1)}% (peak ${normal.lf.peakHz ?? 'N/A'} Hz)`);
console.log(`  HF:  ${normal.hf.percent.toFixed(1)}% (peak ${normal.hf.peakHz ?? 'N/A'} Hz)`);
console.log(`  LF/HF ratio: ${normal.lfHfRatio}`);
console.log(`  Total power: ${normal.totalPower}\n`);

console.log('Interpretation:');
console.log('  LF/HF > 1 → sympathetic dominance (stress, effort)');
console.log('  LF/HF < 1 → parasympathetic dominance (relaxation, recovery)');
console.log(
  `  VLF reliable: ${resonance.vlfReliable ? 'yes (≥2 min recording)' : 'no (too short)'}`
);
