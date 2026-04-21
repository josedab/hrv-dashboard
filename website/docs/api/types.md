---
sidebar_position: 5
---

# Types & Constants

Core type definitions and application constants for the HRV Morning Readiness Dashboard.

## Verdict Type

```typescript
type VerdictType = 'go_hard' | 'moderate' | 'rest'
```

Readiness classification based on HRV analysis:
- **go_hard** — High readiness; optimal for intense training
- **moderate** — Balanced readiness; suitable for balanced training
- **rest** — Low readiness; recommend active recovery or rest

---

## Session

Complete recording session with HRV metrics and logging data.

```typescript
interface Session {
  id: string;                    // UUID v4
  timestamp: string;             // ISO 8601 UTC
  durationSeconds: number;
  rrIntervals: number[];         // R-R intervals in ms
  source: SessionSource;         // 'chest_strap' | 'camera'
  
  // Computed metrics
  rmssd: number;                 // ms, 0-500 typical
  sdnn: number;                  // ms, 20-100 typical
  meanHr: number;                // bpm, 40-120 typical
  pnn50: number;                 // %, 0-100
  
  // Artifact detection
  artifactRate: number;          // 0-1 proportion
  
  // Verdict
  verdict: VerdictType | null;

  // Logging & context
  perceivedReadiness: number | null;  // 1-5 scale
  trainingType: string | null;        // 'Strength' | 'BJJ' | 'Cycling' | 'Rest' | 'Other'
  notes: string | null;
  sleepHours: number | null;          // 0-24
  sleepQuality: number | null;        // 1-5 scale
  stressLevel: number | null;         // 1-5 scale
}
```

---

## HrvMetrics

Computed heart rate variability metrics.

```typescript
interface HrvMetrics {
  rmssd: number;                 // Root Mean Square of Successive Differences (ms)
  sdnn: number;                  // Standard Deviation of Normal N-N intervals (ms)
  meanHr: number;                // Mean heart rate (bpm)
  pnn50: number;                 // Percentage of NN intervals >50ms different (%)
}
```

All fields are 0 if fewer than 2 R-R intervals are provided.

---

## BaselineResult

Personalized HRV baseline computed from recent daily readings.

```typescript
interface BaselineResult {
  rmssdMedian: number;           // Median RMSSD over period (ms)
  rmssdP25: number;              // 25th percentile RMSSD (ms)
  rmssdP75: number;              // 75th percentile RMSSD (ms)
  count: number;                 // Number of readings used
  daysCovered: number;           // Date range in days
}
```

Used for verdict computation. All fields are 0 if insufficient data.

---

## DailyReading

Aggregated daily HRV statistics for trend analysis.

```typescript
interface DailyReading {
  date: string;                  // YYYY-MM-DD
  rmssd: number;                 // Daily median or average (ms)
  sdnn?: number;                 // Daily median SDNN (ms)
  meanHr?: number;               // Daily average HR (bpm)
  sessionCount: number;          // Number of recordings that day
}
```

---

## Settings

User preferences and configuration.

```typescript
interface Settings {
  // Baseline configuration
  baselineWindowDays: number;    // Default: 7 (options: 5, 7, 10, 14)

  // Verdict thresholds (ratio of current rMSSD to baseline median)
  goHardThreshold: number;       // Default: 0.95 (≥95% of baseline → go_hard)
  moderateThreshold: number;     // Default: 0.80 (≥80% of baseline → moderate)
  
  // Verdict mode
  verdictMode: VerdictMode;      // 'fixed' | 'adaptive'
  
  // Device pairing
  pairedDeviceId?: string;       // BLE device UUID
  pairedDeviceName?: string;     // Device name for display
  
  // Recording preferences
  autoFinishRecording: boolean;  // Default: true
  
  // Data & privacy
  enableCrashReporting: boolean; // Default: true
}
```

---

## HeartRateMeasurement

Parsed BLE heart rate measurement data.

```typescript
interface HeartRateMeasurement {
  heartRate: number;             // beats per minute
  rrIntervals: number[];         // R-R intervals in ms
  energyExpended?: number;       // kilojoules (optional)
  sensorContact?: boolean;       // skin contact detected
}
```

---

## Constants

### Verdict Configuration

```typescript
const VERDICT_COLORS = {
  'go_hard': '#22C55E',           // Green
  'moderate': '#F59E0B',          // Amber
  'rest': '#EF4444',              // Red
} as const;

const VERDICT_INFO = {
  'go_hard': {
    label: 'Go Hard',
    description: 'HRV is at or above baseline. Full intensity training is appropriate.',
    emoji: '🟢',
  },
  'moderate': {
    label: 'Moderate',
    description: 'HRV is within normal variance below baseline. Train, but avoid max effort.',
    emoji: '🟡',
  },
  'rest': {
    label: 'Rest',
    description: 'HRV is significantly below baseline. Prioritize recovery.',
    emoji: '🔴',
  },
} as const;
```

---

### R-R Interval & Recording

```typescript
const MIN_RR_INTERVAL_MS = 300;            // 200 bpm ceiling
const MAX_RR_INTERVAL_MS = 2500;           // 24 bpm floor
const RECORDING_DURATION_SECONDS = 300;    // 5 minutes
const MIN_RECORDING_SECONDS = 120;         // 2 minutes minimum
```

---

### Baseline & Analysis

```typescript
const MIN_BASELINE_DAYS = 5;               // Minimum readings for baseline
const ARTIFACT_WARNING_THRESHOLD = 0.05;   // Warn if >5% artifacts
const ARTIFACT_DEVIATION_FACTOR = 0.20;    // 20% deviation for detection
```

---

### Settings Defaults

```typescript
const DEFAULT_SETTINGS: Settings = {
  baselineWindowDays: 7,
  goHardThreshold: 0.95,
  moderateThreshold: 0.8,
  verdictMode: 'fixed',
  pairedDeviceId: undefined,
  pairedDeviceName: undefined,
  autoFinishRecording: true,
  enableCrashReporting: true,
};
```

---

### Colors

```typescript
const COLORS = {
  background: '#0F172A',          // Dark navy
  surface: '#1E293B',             // Slate
  text: '#F8FAFC',                // Light text
  textSecondary: '#94A3B8',       // Muted text
  accent: '#3B82F6',              // Blue
  success: '#22C55E',             // Green (verdict: go_hard)
  warning: '#F59E0B',             // Amber (verdict: moderate)
  error: '#EF4444',               // Red (verdict: rest)
} as const;
```

---

### Training Types

```typescript
const TRAINING_TYPES = ['Strength', 'BJJ', 'Cycling', 'Rest', 'Other'] as const;

type TrainingType = (typeof TRAINING_TYPES)[number];
```

---

## Type Imports

```typescript
// From src/types/index.ts (or individual module files)
import type {
  VerdictType,
  Session,
  HrvMetrics,
  BaselineResult,
  DailyReading,
  Settings,
  HeartRateMeasurement,
  TrainingType,
} from 'src/types';

// Constants
import {
  MIN_RR_INTERVAL_MS,
  MAX_RR_INTERVAL_MS,
  RECORDING_DURATION_SECONDS,
  MIN_RECORDING_SECONDS,
  MIN_BASELINE_DAYS,
  ARTIFACT_WARNING_THRESHOLD,
  ARTIFACT_DEVIATION_FACTOR,
  DEFAULT_SETTINGS,
  COLORS,
  VERDICT_COLORS,
  VERDICT_INFO,
  TRAINING_TYPES,
  TRAINING_INFO,
} from 'src/constants';
```

---

## Usage Patterns

### Creating a Session

```typescript
import { generateId } from 'src/utils/uuid';
import { todayString } from 'src/utils/dateUtils';
import type { Session, HrvMetrics } from 'src/types';

const metrics: HrvMetrics = {
  rmssd: 45.2,
  sdnn: 32.1,
  meanHr: 62,
  pnn50: 28.5,
};

const session: Session = {
  id: generateId(),
  date: todayString(),
  rrIntervals: [820, 850, 810, 835],
  ...metrics,
  artifactRate: 0.02,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
```

### Checking Readiness

```typescript
import { computeVerdict } from 'src/hrv';
import { VERDICT_INFO } from 'src/constants';

const verdict = computeVerdict(currentRmssd, baseline, settings);
if (verdict) {
  const { label, emoji } = VERDICT_INFO[verdict];
  console.log(`${emoji} ${label}`);
}
```
