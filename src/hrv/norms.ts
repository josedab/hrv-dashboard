/**
 * Age- and sex-stratified HRV normative data.
 *
 * Provides population percentile ranks for rMSSD and SDNN so users
 * can contextualize their numbers ("Your rMSSD is in the 72nd percentile
 * for men aged 30–39").
 *
 * Data sourced from:
 *   - Nunan et al. (2010) "A quantitative systematic review of normal
 *     values for short-term heart rate variability in healthy adults"
 *   - Shaffer & Ginsberg (2017) "An Overview of Heart Rate Variability
 *     Metrics and Norms"
 *
 * All values are for supine, short-term (5 min) recordings — matching
 * this app's protocol. Values are approximate and intended for consumer
 * guidance, not clinical diagnosis.
 */

export type BiologicalSex = 'male' | 'female';

export interface AgeGroup {
  minAge: number;
  maxAge: number;
  label: string;
}

export interface NormativePercentiles {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface NormEntry {
  ageGroup: AgeGroup;
  sex: BiologicalSex;
  rmssd: NormativePercentiles;
  sdnn: NormativePercentiles;
}

/**
 * Normative rMSSD and SDNN values (ms) by age group and sex.
 *
 * Approximate percentiles derived from published meta-analyses.
 * These are population-level estimates; individual variation is high.
 */
export const NORM_TABLE: NormEntry[] = [
  // Males
  {
    ageGroup: { minAge: 18, maxAge: 29, label: '18–29' },
    sex: 'male',
    rmssd: { p10: 19, p25: 28, p50: 42, p75: 64, p90: 90 },
    sdnn: { p10: 25, p25: 37, p50: 54, p75: 78, p90: 105 },
  },
  {
    ageGroup: { minAge: 30, maxAge: 39, label: '30–39' },
    sex: 'male',
    rmssd: { p10: 15, p25: 23, p50: 36, p75: 55, p90: 78 },
    sdnn: { p10: 22, p25: 33, p50: 48, p75: 68, p90: 93 },
  },
  {
    ageGroup: { minAge: 40, maxAge: 49, label: '40–49' },
    sex: 'male',
    rmssd: { p10: 12, p25: 18, p50: 28, p75: 44, p90: 65 },
    sdnn: { p10: 18, p25: 28, p50: 41, p75: 59, p90: 82 },
  },
  {
    ageGroup: { minAge: 50, maxAge: 59, label: '50–59' },
    sex: 'male',
    rmssd: { p10: 9, p25: 14, p50: 22, p75: 35, p90: 52 },
    sdnn: { p10: 15, p25: 23, p50: 35, p75: 50, p90: 70 },
  },
  {
    ageGroup: { minAge: 60, maxAge: 99, label: '60+' },
    sex: 'male',
    rmssd: { p10: 7, p25: 11, p50: 18, p75: 28, p90: 42 },
    sdnn: { p10: 12, p25: 19, p50: 29, p75: 42, p90: 60 },
  },
  // Females
  {
    ageGroup: { minAge: 18, maxAge: 29, label: '18–29' },
    sex: 'female',
    rmssd: { p10: 17, p25: 26, p50: 39, p75: 58, p90: 82 },
    sdnn: { p10: 23, p25: 34, p50: 50, p75: 72, p90: 98 },
  },
  {
    ageGroup: { minAge: 30, maxAge: 39, label: '30–39' },
    sex: 'female',
    rmssd: { p10: 14, p25: 21, p50: 33, p75: 50, p90: 72 },
    sdnn: { p10: 20, p25: 30, p50: 44, p75: 63, p90: 87 },
  },
  {
    ageGroup: { minAge: 40, maxAge: 49, label: '40–49' },
    sex: 'female',
    rmssd: { p10: 11, p25: 17, p50: 26, p75: 40, p90: 58 },
    sdnn: { p10: 16, p25: 25, p50: 37, p75: 54, p90: 75 },
  },
  {
    ageGroup: { minAge: 50, maxAge: 59, label: '50–59' },
    sex: 'female',
    rmssd: { p10: 8, p25: 13, p50: 20, p75: 32, p90: 48 },
    sdnn: { p10: 13, p25: 21, p50: 32, p75: 46, p90: 65 },
  },
  {
    ageGroup: { minAge: 60, maxAge: 99, label: '60+' },
    sex: 'female',
    rmssd: { p10: 6, p25: 10, p50: 16, p75: 26, p90: 38 },
    sdnn: { p10: 10, p25: 17, p50: 26, p75: 38, p90: 55 },
  },
];

export interface PercentileResult {
  /** Estimated percentile rank (0–100). */
  percentile: number;
  /** Human-readable interpretation. */
  label: string;
  /** The age group used for comparison. */
  ageGroup: string;
  /** The sex used for comparison. */
  sex: BiologicalSex;
  /** Source citation. */
  source: string;
}

/**
 * Finds the normative entry for a given age and sex.
 * @returns NormEntry or null if no matching age group.
 */
export function findNormEntry(age: number, sex: BiologicalSex): NormEntry | null {
  return (
    NORM_TABLE.find((e) => e.sex === sex && age >= e.ageGroup.minAge && age <= e.ageGroup.maxAge) ??
    null
  );
}

/**
 * Interpolates a percentile rank from a set of known percentile values.
 * Uses linear interpolation between the nearest known percentile boundaries.
 */
function interpolatePercentile(value: number, pcts: NormativePercentiles): number {
  const points: [number, number][] = [
    [pcts.p10, 10],
    [pcts.p25, 25],
    [pcts.p50, 50],
    [pcts.p75, 75],
    [pcts.p90, 90],
  ];

  // Below p10
  if (value <= points[0][0]) {
    return Math.max(1, Math.round((value / points[0][0]) * 10));
  }

  // Above p90
  if (value >= points[points.length - 1][0]) {
    const excess = (value - points[points.length - 1][0]) / points[points.length - 1][0];
    return Math.min(99, Math.round(90 + excess * 50));
  }

  // Interpolate between brackets
  for (let i = 0; i < points.length - 1; i++) {
    const [v0, p0] = points[i];
    const [v1, p1] = points[i + 1];
    if (value >= v0 && value <= v1) {
      const t = (value - v0) / (v1 - v0);
      return Math.round(p0 + t * (p1 - p0));
    }
  }

  return 50; // fallback
}

function percentileLabel(pct: number): string {
  if (pct >= 90) return 'Excellent';
  if (pct >= 75) return 'Above Average';
  if (pct >= 50) return 'Average';
  if (pct >= 25) return 'Below Average';
  return 'Low';
}

const SOURCE_CITATION = 'Nunan et al. 2010, Shaffer & Ginsberg 2017';

/**
 * Computes the user's rMSSD percentile rank compared to population norms.
 * @returns PercentileResult or null if age/sex not provided or no matching norms.
 */
export function computeRmssdPercentile(
  rmssd: number,
  age: number | null,
  sex: BiologicalSex | null
): PercentileResult | null {
  if (age === null || sex === null || age < 18) return null;

  const entry = findNormEntry(age, sex);
  if (!entry) return null;

  const percentile = interpolatePercentile(rmssd, entry.rmssd);

  return {
    percentile,
    label: percentileLabel(percentile),
    ageGroup: entry.ageGroup.label,
    sex,
    source: SOURCE_CITATION,
  };
}

/**
 * Computes the user's SDNN percentile rank compared to population norms.
 * @returns PercentileResult or null if age/sex not provided or no matching norms.
 */
export function computeSdnnPercentile(
  sdnn: number,
  age: number | null,
  sex: BiologicalSex | null
): PercentileResult | null {
  if (age === null || sex === null || age < 18) return null;

  const entry = findNormEntry(age, sex);
  if (!entry) return null;

  const percentile = interpolatePercentile(sdnn, entry.sdnn);

  return {
    percentile,
    label: percentileLabel(percentile),
    ageGroup: entry.ageGroup.label,
    sex,
    source: SOURCE_CITATION,
  };
}
