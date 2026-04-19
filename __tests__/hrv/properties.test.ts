/**
 * Property-based tests for HRV metric computations.
 *
 * Uses fast-check to verify invariants that must hold for ALL valid
 * inputs, not just the specific test vectors in metrics.test.ts.
 * These tests catch edge cases that hand-written examples miss.
 */
import fc from 'fast-check';
import {
  computeRmssd,
  computeSdnn,
  computeMeanHr,
  computePnn50,
  computeHrvMetrics,
} from '../../src/hrv/metrics';
import { filterArtifacts, detectArtifacts } from '../../src/hrv/artifacts';
import { computeBaseline } from '../../src/hrv/baseline';
import { computeVerdict } from '../../src/hrv/verdict';

// Physiologically plausible RR interval range (ms)
const rrArbitrary = fc.double({ min: 300, max: 2500, noNaN: true, noDefaultInfinity: true });
const rrArrayArbitrary = fc.array(rrArbitrary, { minLength: 2, maxLength: 500 });

describe('HRV metrics properties', () => {
  it('rMSSD is always non-negative and finite', () => {
    fc.assert(
      fc.property(rrArrayArbitrary, (rr) => {
        const result = computeRmssd(rr);
        return Number.isFinite(result) && result >= 0;
      })
    );
  });

  it('SDNN is always non-negative and finite', () => {
    fc.assert(
      fc.property(rrArrayArbitrary, (rr) => {
        const result = computeSdnn(rr);
        return Number.isFinite(result) && result >= 0;
      })
    );
  });

  it('mean HR is positive and finite for valid RR intervals', () => {
    fc.assert(
      fc.property(rrArrayArbitrary, (rr) => {
        const result = computeMeanHr(rr);
        return Number.isFinite(result) && result > 0;
      })
    );
  });

  it('pNN50 is between 0 and 100 inclusive', () => {
    fc.assert(
      fc.property(rrArrayArbitrary, (rr) => {
        const result = computePnn50(rr);
        return Number.isFinite(result) && result >= 0 && result <= 100;
      })
    );
  });

  it('SDNN is near zero when all intervals are identical', () => {
    fc.assert(
      fc.property(rrArbitrary, fc.integer({ min: 2, max: 100 }), (rr, count) => {
        const result = computeSdnn(Array(count).fill(rr));
        return result < 1e-10; // near-zero within floating-point tolerance
      })
    );
  });

  it('rMSSD is near zero when all intervals are identical', () => {
    fc.assert(
      fc.property(rrArbitrary, fc.integer({ min: 2, max: 100 }), (rr, count) => {
        const result = computeRmssd(Array(count).fill(rr));
        return result < 1e-10;
      })
    );
  });

  it('computeHrvMetrics returns all finite fields', () => {
    fc.assert(
      fc.property(rrArrayArbitrary, (rr) => {
        const m = computeHrvMetrics(rr);
        return (
          Number.isFinite(m.rmssd) &&
          Number.isFinite(m.sdnn) &&
          Number.isFinite(m.meanHr) &&
          Number.isFinite(m.pnn50) &&
          Number.isFinite(m.artifactRate) &&
          m.artifactRate >= 0 &&
          m.artifactRate <= 1
        );
      })
    );
  });
});

describe('artifact detection properties', () => {
  it('artifact array length matches input length', () => {
    fc.assert(
      fc.property(rrArrayArbitrary, (rr) => {
        const artifacts = detectArtifacts(rr);
        return artifacts.length === rr.length;
      })
    );
  });

  it('artifact rate is between 0 and 1', () => {
    fc.assert(
      fc.property(rrArrayArbitrary, (rr) => {
        const { artifactRate } = filterArtifacts(rr);
        return artifactRate >= 0 && artifactRate <= 1;
      })
    );
  });

  it('clean intervals are a subset of original intervals', () => {
    fc.assert(
      fc.property(rrArrayArbitrary, (rr) => {
        const { cleanIntervals } = filterArtifacts(rr);
        return cleanIntervals.length <= rr.length;
      })
    );
  });

  it('higher tolerance produces equal or fewer artifacts', () => {
    fc.assert(
      fc.property(rrArrayArbitrary, (rr) => {
        const strict = filterArtifacts(rr, 1.0);
        const lenient = filterArtifacts(rr, 2.0);
        return lenient.cleanIntervals.length >= strict.cleanIntervals.length;
      })
    );
  });
});

describe('baseline properties', () => {
  it('baseline median is within range of input values', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 10, max: 200, noNaN: true, noDefaultInfinity: true }), {
          minLength: 1,
          maxLength: 30,
        }),
        (values) => {
          const readings = values.map((rmssd, i) => ({
            date: `2026-04-${String(i + 1).padStart(2, '0')}`,
            rmssd,
            verdict: null as null,
          }));
          const baseline = computeBaseline(readings);
          if (baseline.dayCount === 0) return true;
          const min = Math.min(...values);
          const max = Math.max(...values);
          return baseline.median >= min && baseline.median <= max;
        }
      )
    );
  });
});

describe('verdict properties', () => {
  it('verdict is always one of the valid values or null', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 200, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 10, max: 100, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 0, max: 14 }),
        (rmssd, median, dayCount) => {
          const baseline = { median, dayCount, values: Array(dayCount).fill(median) };
          const verdict = computeVerdict(rmssd, baseline);
          return (
            verdict === null ||
            verdict === 'go_hard' ||
            verdict === 'moderate' ||
            verdict === 'rest'
          );
        }
      )
    );
  });

  it('higher rMSSD relative to baseline never produces a worse verdict', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 10, max: 100, noNaN: true, noDefaultInfinity: true }),
        (median) => {
          const baseline = { median, dayCount: 7, values: Array(7).fill(median) };
          const verdicts = [0.5, 0.8, 0.95, 1.2].map((ratio) =>
            computeVerdict(median * ratio, baseline)
          );
          const rank = (v: string | null) =>
            v === 'go_hard' ? 3 : v === 'moderate' ? 2 : v === 'rest' ? 1 : 0;
          // Each verdict should be >= the previous one (monotonic)
          for (let i = 1; i < verdicts.length; i++) {
            if (rank(verdicts[i]) < rank(verdicts[i - 1])) return false;
          }
          return true;
        }
      )
    );
  });
});
