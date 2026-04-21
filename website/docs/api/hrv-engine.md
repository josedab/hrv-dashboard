---
sidebar_position: 1
---

# HRV Engine

The HRV Engine module provides core heart rate variability computation and analysis functions. It handles metric calculations, artifact detection, baseline tracking, and readiness verdicts.

## Core Functions

### computeHrvMetrics

Computes all HRV metrics from raw R-R intervals. This is the primary entry point for HRV analysis.

```typescript
computeHrvMetrics(rawRrIntervals: number[]): HrvMetrics
```

**Parameters:**
- `rawRrIntervals` — Array of R-R intervals in milliseconds

**Returns:**
- `HrvMetrics` object with RMSSD, SDNN, mean HR, and PNN50

**Behavior:**
- Automatically filters out artifacts using adaptive detection
- Returns all-zero metrics if fewer than 2 intervals provided
- Ensures data integrity before calculation

**Example:**
```typescript
const metrics = computeHrvMetrics([800, 850, 820, 880, 810]);
console.log(metrics.rmssd); // e.g., 42.3
```

---

### computeRmssd

Calculates Root Mean Square of Successive Differences.

```typescript
computeRmssd(rrIntervals: number[]): number
```

**Formula:** √(Σ(RR[i] - RR[i-1])² / (N-1))

**Parameters:**
- `rrIntervals` — Cleaned R-R intervals in milliseconds

**Returns:**
- RMSSD value in milliseconds (0–500 typical range)

**Note:** Returns 0 for arrays with fewer than 2 elements.

---

### computeSdnn

Calculates Standard Deviation of Normal N-N intervals.

```typescript
computeSdnn(rrIntervals: number[]): number
```

**Formula:** Population standard deviation (÷N, not ÷N-1)

**Parameters:**
- `rrIntervals` — Cleaned R-R intervals in milliseconds

**Returns:**
- SDNN value in milliseconds (typical: 20–100ms)

---

### computeMeanHr

Calculates mean heart rate from R-R intervals.

```typescript
computeMeanHr(rrIntervals: number[]): number
```

**Formula:** 60,000 / mean(RR in ms)

**Parameters:**
- `rrIntervals` — Cleaned R-R intervals in milliseconds

**Returns:**
- Heart rate in beats per minute (bpm)

---

### computePnn50

Calculates percentage of successive R-R differences greater than 50ms.

```typescript
computePnn50(rrIntervals: number[]): number
```

**Parameters:**
- `rrIntervals` — Cleaned R-R intervals in milliseconds

**Returns:**
- Percentage as 0–100 (parasympathetic marker)

---

## Artifact Detection

### detectArtifacts

Identifies likely ectopic beats or recording artifacts using a 5-beat moving median method.

```typescript
detectArtifacts(
  rrIntervals: number[],
  deviationFactor?: number
): boolean[]
```

**Parameters:**
- `rrIntervals` — Raw R-R intervals
- `deviationFactor` — Multiplier for detection threshold (default: 0.20)

**Returns:**
- Boolean array where `true` indicates artifact at that index

**Algorithm:**
- Computes 5-beat moving median for each interval
- Flags intervals deviating by `deviationFactor * median` from neighbors
- Adaptive to individual recording baseline

**Example:**
```typescript
const artifacts = detectArtifacts([800, 2100, 820, 810, 850], 0.20);
// artifacts[1] likely true (2100ms is outlier)
```

---

### filterArtifacts

Removes detected artifacts and returns cleaned intervals with statistics.

```typescript
filterArtifacts(rrIntervals: number[]): {
  cleanIntervals: number[];
  artifactRate: number;
  artifacts: boolean[];
}
```

**Returns:**
- `cleanIntervals` — Artifact-free R-R intervals
- `artifactRate` — Proportion of intervals flagged (0–1)
- `artifacts` — Boolean array from detection

---

## Baseline & Trends

### computeBaseline

Calculates personalized HRV baseline from recent daily readings.

```typescript
computeBaseline(
  dailyReadings: DailyReading[],
  windowDays?: number
): BaselineResult
```

**Parameters:**
- `dailyReadings` — Array of `DailyReading` objects (typically sorted ascending by date)
- `windowDays` — Look-back window in days (default: 28)

**Returns:**
```typescript
{
  rmssdMedian: number;     // Baseline RMSSD (ms)
  rmssdP25: number;        // 25th percentile
  rmssdP75: number;        // 75th percentile
  count: number;           // Number of readings
  daysCovered: number;     // Date range covered
}
```

**Behavior:**
- Filters to readings within `windowDays`
- Returns zeros if insufficient data
- Used for verdict computation

---

### computeMedian

Helper function to compute median of a numeric array.

```typescript
computeMedian(values: number[]): number
```

**Parameters:**
- `values` — Array of numbers

**Returns:**
- Median value (50th percentile)

---

## Verdict Generation

### computeVerdict

Generates a readiness verdict based on current RMSSD vs. baseline.

```typescript
computeVerdict(
  currentRmssd: number,
  baseline: BaselineResult,
  settings?: Settings
): VerdictType | null
```

**Parameters:**
- `currentRmssd` — Today's measured RMSSD
- `baseline` — Baseline metrics from recent history
- `settings` — Threshold configuration (optional)

**Returns:**
- `'go_hard'` — RMSSD well above baseline (energized)
- `'moderate'` — RMSSD near baseline (balanced)
- `'rest'` — RMSSD significantly below baseline (fatigued)
- `null` — Insufficient baseline data

**Logic:**
- Uses `Settings.goHardThreshold` and `Settings.moderateThreshold`
- Compares current RMSSD to baseline percentiles
- Falls back to defaults if settings not provided

**Example:**
```typescript
const verdict = computeVerdict(55, baseline, settings);
// Returns 'go_hard' if 55ms exceeds baseline 75th percentile
```

---

## Type Definitions

See [Types & Constants](./types.md) for `HrvMetrics`, `BaselineResult`, `VerdictType`, and `DailyReading` interfaces.

---

## Spectral Analysis

**Module:** `src/hrv/spectral.ts`

### computeSpectralMetrics

Computes frequency-domain HRV metrics using Goertzel algorithm with 4 Hz resampling.

```typescript
computeSpectralMetrics(rrIntervals: number[]): SpectralResult
```

**Returns:**
```typescript
interface SpectralResult {
  vlf: { power: number; percent: number };   // 0.003–0.04 Hz
  lf: { power: number; percent: number };    // 0.04–0.15 Hz
  hf: { power: number; percent: number };    // 0.15–0.40 Hz
  lfHfRatio: number;
  totalPower: number;
  vlfReliable: boolean;  // true if recording ≥ 2 min
}
```

**Requirements:** Minimum 60 RR intervals. VLF requires ≥ 120 seconds of recording.

---

## Recovery Score

**Module:** `src/hrv/recovery.ts`

### computeRecoveryScore

Composite recovery score (0–100) from HRV + subjective inputs.

```typescript
computeRecoveryScore(session: Session, baseline: BaselineResult): RecoveryScore | null
```

**Weights:** HRV (0.4), Sleep (0.25), Stress (0.2), Readiness (0.15). HRV component capped at 1.2× baseline.

### estimateTrainingLoad

RPE-based training load estimate (0–100).

```typescript
estimateTrainingLoad(session: Session): number
```

---

## Training Stress Balance

**Module:** `src/hrv/trainingStress.ts`

### computeTsbSeries

Computes ATL/CTL/TSB series using exponential weighted averages.

```typescript
computeTsbSeries(dailyLoads: DailyLoad[]): TsbPoint[]
```

**Time constants:** ATL = 7 days (fatigue), CTL = 42 days (fitness). TSB = CTL − ATL.

**Zones:** Fresh (> +15), Optimal (−10 to +15), Fatigued (−30 to −10), Overreaching (< −30).

---

## Adaptive Thresholds

**Module:** `src/hrv/adaptiveThresholds.ts`

### computeAdaptiveVerdict

Percentile-based verdict with optional Bayesian feedback from perceived-readiness labels.

```typescript
computeAdaptiveVerdict(
  currentRmssd: number,
  history: Session[],
  baseline: BaselineResult,
  fallback: VerdictType,
  thresholds?: AdaptiveThresholds
): AdaptiveResult
```

**Defaults:** Rest at 20th percentile, Go Hard at 65th percentile. Requires 30+ days of history. Bayesian adjustment of ±10% with 10+ labeled sessions.

---

## Coach Narrative

**Module:** `src/hrv/coachNarrative.ts`

### generateNarrative

Template-based daily recovery brief combining HRV, sleep, training, and trend data.

```typescript
generateNarrative(ctx: NarrativeContext): NarrativeBrief
```

**Returns:** `{ text: string; clauses: string[]; emoji: string }`

---

## Prediction

**Module:** `src/hrv/prediction.ts`

### predictNextDay

Predicts tomorrow's rMSSD using linear regression + TSB adjustment.

```typescript
predictNextDay(
  sessions: Session[],
  baseline: BaselineResult,
  thresholds: VerdictThresholds
): PredictionResult | null
```

**Requires:** 7+ days of data. Confidence: low (<14 days), medium (14–30), high (>30).

---

## Population Norms

**Module:** `src/hrv/norms.ts`

### computeRmssdPercentile / computeSdnnPercentile

Rank against age/sex-stratified population data.

```typescript
computeRmssdPercentile(rmssd: number, age: number, sex: BiologicalSex): PercentileResult | null
computeSdnnPercentile(sdnn: number, age: number, sex: BiologicalSex): PercentileResult | null
```

**Age groups:** 18–29, 30–39, 40–49, 50–59, 60+. **Labels:** Excellent (≥p90), Above Average (≥p75), Average (≥p50), Below Average (≥p25), Low.

---

## Orthostatic Test

**Module:** `src/hrv/orthostatic.ts`

### computeOrthostaticResult

Computes supine vs. standing HRV comparison with reactivity scoring.

```typescript
computeOrthostaticResult(supineRr: number[], standingRr: number[]): OrthostaticResult
```

**Returns:** Supine/standing metrics, deltaRmssd, deltaHr, reactivityScore (0–100, weighted 0.6 HRV / 0.4 HR).

**Interpretation:** Blunted (<10% drop + <5 bpm rise = overtraining signal), Exaggerated (>50% drop OR >35 bpm rise), Normal, Atypical.

---

## Coherence Trainer

**Module:** `src/biofeedback/coherence.ts`

### computeCoherence

Real-time coherence score from RR intervals using Goertzel frequency analysis.

```typescript
computeCoherence(rrIntervals: number[]): CoherenceResult  // 0–100 score
```

**Requires:** 60+ RR intervals (~1 min). Resonance bonus applied for peaks at 0.08–0.13 Hz (cardiac resonance frequency).

### computePacerState

Breathing pacer state machine (5s inhale / 5s exhale = 6 breaths/min resonance frequency).

```typescript
computePacerState(elapsed: number, config?: PacerConfig): PacerState
```
