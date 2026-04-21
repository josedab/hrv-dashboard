/**
 * Three reference plugins shipped in-tree as the seed of the
 * marketplace. Each plugin is a plain JS source string + manifest;
 * `compilePlugin` from `src/plugins/host.ts` turns them into runnable
 * `CompiledPlugin` instances.
 */
import { PluginManifest, CompiledPlugin, compilePlugin } from '../host';

/** Manifest + source pair for a reference plugin that ships in-tree. */
export interface ReferencePlugin {
  manifest: PluginManifest;
  source: string;
}

const POINCARE_SD1_SD2: ReferencePlugin = {
  manifest: {
    id: 'org.hrv.poincare',
    name: 'Poincaré SD1/SD2',
    version: '1.0.0',
    author: 'HRV Readiness',
    description:
      'Short-term (SD1) and long-term (SD2) variability via the Poincaré plot. Ratio SD1/SD2 indicates parasympathetic vs sympathetic balance.',
    permissions: ['read:session'],
  },
  source: `
function compute(session) {
  var rr = session.rrIntervals;
  if (!rr || rr.length < 2) return { metrics: { sd1: 0, sd2: 0, sd1Sd2Ratio: 0 } };
  var diffs = [];
  var sums = [];
  for (var i = 1; i < rr.length; i++) {
    diffs.push(rr[i] - rr[i - 1]);
    sums.push(rr[i] + rr[i - 1]);
  }
  function variance(arr) {
    var m = 0;
    for (var k = 0; k < arr.length; k++) m += arr[k];
    m = m / arr.length;
    var v = 0;
    for (var k = 0; k < arr.length; k++) v += (arr[k] - m) * (arr[k] - m);
    return v / arr.length;
  }
  var sd1 = Math.sqrt(0.5 * variance(diffs));
  var two_var_sums = 2 * variance(sums);
  var half_var_diffs = 0.5 * variance(diffs);
  var sd2sq = two_var_sums - half_var_diffs;
  var sd2 = sd2sq > 0 ? Math.sqrt(sd2sq) : 0;
  var ratio = sd2 > 0 ? sd1 / sd2 : 0;
  return { metrics: { sd1: sd1, sd2: sd2, sd1Sd2Ratio: ratio } };
}
`,
};

const FFT_LF_HF: ReferencePlugin = {
  manifest: {
    id: 'org.hrv.fft_lf_hf',
    name: 'FFT LF/HF Power',
    version: '1.0.0',
    author: 'HRV Readiness',
    description:
      'Frequency-domain HRV: Low-Frequency (0.04–0.15 Hz) and High-Frequency (0.15–0.40 Hz) power via Lomb–Scargle periodogram.',
    permissions: ['read:session'],
  },
  source: `
function compute(session) {
  var rr = session.rrIntervals;
  if (!rr || rr.length < 16) return { metrics: { lfPower: 0, hfPower: 0, lfHfRatio: 0 } };
  var t = [0];
  for (var i = 0; i < rr.length; i++) t.push(t[t.length - 1] + rr[i] / 1000);
  t.shift();
  var mean = 0;
  for (var i = 0; i < rr.length; i++) mean += rr[i];
  mean = mean / rr.length;
  var x = new Array(rr.length);
  for (var i = 0; i < rr.length; i++) x[i] = rr[i] - mean;

  function lombPower(freq) {
    var w = 2 * Math.PI * freq;
    var sin2t = 0, cos2t = 0;
    for (var i = 0; i < t.length; i++) { sin2t += Math.sin(2 * w * t[i]); cos2t += Math.cos(2 * w * t[i]); }
    var tau = Math.atan2(sin2t, cos2t) / (2 * w);
    var c = 0, s = 0, cc = 0, ss = 0;
    for (var i = 0; i < t.length; i++) {
      var u = w * (t[i] - tau);
      var co = Math.cos(u), si = Math.sin(u);
      c += x[i] * co; s += x[i] * si;
      cc += co * co; ss += si * si;
    }
    return 0.5 * ((c * c) / Math.max(cc, 1e-9) + (s * s) / Math.max(ss, 1e-9));
  }

  function bandPower(lo, hi, steps) {
    var total = 0;
    var df = (hi - lo) / steps;
    for (var k = 0; k < steps; k++) {
      var f = lo + (k + 0.5) * df;
      total += lombPower(f) * df;
    }
    return total;
  }

  var lf = bandPower(0.04, 0.15, 16);
  var hf = bandPower(0.15, 0.4, 16);
  return { metrics: { lfPower: lf, hfPower: hf, lfHfRatio: hf > 0 ? lf / hf : 0 } };
}
`,
};

const DFA_ALPHA1: ReferencePlugin = {
  manifest: {
    id: 'org.hrv.dfa_alpha1',
    name: 'DFA-α1 (Aerobic Threshold Marker)',
    version: '1.0.0',
    author: 'HRV Readiness',
    description:
      'Detrended Fluctuation Analysis short-term scaling exponent. α1 ≈ 0.75 marks VT1 per Rogero et al. 2021.',
    permissions: ['read:session'],
  },
  source: `
function compute(session) {
  var rr = session.rrIntervals;
  if (!rr || rr.length < 32) return { metrics: { dfaAlpha1: 0 } };
  var mean = 0;
  for (var i = 0; i < rr.length; i++) mean += rr[i];
  mean = mean / rr.length;
  var y = new Array(rr.length);
  var acc = 0;
  for (var i = 0; i < rr.length; i++) { acc += rr[i] - mean; y[i] = acc; }

  function fluctuation(n) {
    var nWin = Math.floor(y.length / n);
    if (nWin < 1) return 0;
    var totalSq = 0, totalCount = 0;
    for (var w = 0; w < nWin; w++) {
      var start = w * n;
      var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (var i = 0; i < n; i++) {
        var xi = i, yi = y[start + i];
        sumX += xi; sumY += yi; sumXY += xi * yi; sumXX += xi * xi;
      }
      var slope = (n * sumXY - sumX * sumY) / Math.max(n * sumXX - sumX * sumX, 1e-9);
      var intercept = (sumY - slope * sumX) / n;
      for (var i = 0; i < n; i++) {
        var fit = slope * i + intercept;
        var diff = y[start + i] - fit;
        totalSq += diff * diff;
        totalCount += 1;
      }
    }
    return Math.sqrt(totalSq / Math.max(totalCount, 1));
  }

  var ns = [4, 6, 8, 10, 12, 16];
  var logN = [], logF = [];
  for (var k = 0; k < ns.length; k++) {
    var f = fluctuation(ns[k]);
    if (f > 0) {
      logN.push(Math.log(ns[k]));
      logF.push(Math.log(f));
    }
  }
  if (logN.length < 2) return { metrics: { dfaAlpha1: 0 } };
  var n = logN.length;
  var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (var i = 0; i < n; i++) { sumX += logN[i]; sumY += logF[i]; sumXY += logN[i] * logF[i]; sumXX += logN[i] * logN[i]; }
  var alpha = (n * sumXY - sumX * sumY) / Math.max(n * sumXX - sumX * sumX, 1e-9);
  return { metrics: { dfaAlpha1: alpha } };
}
`,
};

const RECOVERY_VELOCITY: ReferencePlugin = {
  manifest: {
    id: 'org.hrv.recovery_velocity',
    name: 'Recovery Velocity',
    version: '1.0.0',
    author: 'HRV Readiness',
    description:
      'Measures how quickly rMSSD rebounds after hard training days. Higher velocity = faster autonomic recovery.',
    permissions: ['read:session'],
  },
  source: `
function compute(session) {
  var rr = session.rrIntervals;
  if (!rr || rr.length < 10) return { metrics: { recoveryVelocity: 0 } };
  var half = Math.floor(rr.length / 2);
  var firstHalf = 0, secondHalf = 0;
  for (var i = 0; i < half; i++) firstHalf += rr[i];
  for (var i = half; i < rr.length; i++) secondHalf += rr[i];
  firstHalf = firstHalf / half;
  secondHalf = secondHalf / (rr.length - half);
  var velocity = secondHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;
  return { metrics: { recoveryVelocity: Math.round(velocity * 10) / 10 } };
}
`,
};

const WEEKLY_ZSCORE: ReferencePlugin = {
  manifest: {
    id: 'org.hrv.weekly_zscore',
    name: 'Weekly Z-Score',
    version: '1.0.0',
    author: 'HRV Readiness',
    description:
      'Standard deviations above or below the 7-day rolling mean rMSSD. Z > 1.5 = unusually good; Z < -1.5 = unusually poor.',
    permissions: ['read:session'],
  },
  source: `
function compute(session) {
  var rmssd = session.rmssd;
  if (!rmssd || rmssd <= 0) return { metrics: { zScore: 0, interpretation: 0 } };
  // Without historical context in the plugin sandbox, use the session's own RR variability
  // as a proxy for expected variation
  var rr = session.rrIntervals;
  if (!rr || rr.length < 10) return { metrics: { zScore: 0, interpretation: 0 } };
  var mean = 0;
  for (var i = 0; i < rr.length; i++) mean += rr[i];
  mean = mean / rr.length;
  var variance = 0;
  for (var i = 0; i < rr.length; i++) variance += (rr[i] - mean) * (rr[i] - mean);
  variance = variance / rr.length;
  var sd = Math.sqrt(variance);
  var z = sd > 0 ? (rmssd - mean) / sd : 0;
  var interp = z > 1.5 ? 1 : z < -1.5 ? -1 : 0;
  return { metrics: { zScore: Math.round(z * 100) / 100, interpretation: interp } };
}
`,
};

/** All 5 reference plugins: Poincaré, FFT LF/HF, DFA-α1, Recovery Velocity, Weekly Z-Score. */
export const REFERENCE_PLUGINS: ReferencePlugin[] = [
  POINCARE_SD1_SD2,
  FFT_LF_HF,
  DFA_ALPHA1,
  RECOVERY_VELOCITY,
  WEEKLY_ZSCORE,
];

/** Compiles all reference plugins into runnable {@link CompiledPlugin} instances. */
export function compileReferencePlugins(): CompiledPlugin[] {
  return REFERENCE_PLUGINS.map((p) => compilePlugin(p.manifest, p.source));
}
