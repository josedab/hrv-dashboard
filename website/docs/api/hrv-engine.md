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
