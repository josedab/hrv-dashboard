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
  date: string;                  // YYYY-MM-DD
  rrIntervals: number[];         // R-R intervals in ms
  
  // Computed metrics
  rmssd: number;                 // ms, 0-500 typical
  sdnn: number;                  // ms, 20-100 typical
  meanHr: number;                // bpm, 40-120 typical
  pnn50: number;                 // %, 0-100
  
  // Artifact detection
  artifactRate: number;          // 0-1 proportion
  
  // Logging & context
  perceivedReadiness?: number;   // 1-5 scale, user-reported
  trainingType?: string;         // 'easy' | 'moderate' | 'hard' | 'rest'
  notes?: string;                // User notes
  sleepHours?: number;           // Hours of sleep
  sleepQuality?: number;         // 1-5 scale
  stressLevel?: number;          // 1-5 scale
  
  // Timestamps
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
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
  // Verdict thresholds (multipliers of baseline RMSSD)
  goHardThreshold: number;       // Default: 1.25 (>125% baseline → go_hard)
  moderateThreshold: number;     // Default: 0.75 (<75% baseline → rest)
  
  // Device pairing
  pairedDeviceId?: string;       // BLE device UUID
  pairedDeviceName?: string;     // Device name for display
  
  // Recording preferences
  autoStartRecording: boolean;   // Default: false
  autoFinishRecording: boolean;  // Default: false
  
  // Notifications
  enableNotifications: boolean;  // Default: true
  notifyOnLowReadiness: boolean; // Default: true
  
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
  'go_hard': '#10B981',           // Emerald green
  'moderate': '#F59E0B',          // Amber
  'rest': '#EF4444',              // Red
} as const;

const VERDICT_INFO = {
  'go_hard': {
    label: 'Go Hard',
    description: 'High readiness for intense training',
    emoji: '🔥',
  },
  'moderate': {
    label: 'Moderate',
    description: 'Balanced readiness for mixed training',
    emoji: '⚖️',
  },
  'rest': {
    label: 'Rest',
    description: 'Low readiness; recommend recovery',
    emoji: '😴',
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
  goHardThreshold: 1.25,
  moderateThreshold: 0.75,
  pairedDeviceId: undefined,
  pairedDeviceName: undefined,
  autoStartRecording: false,
  autoFinishRecording: false,
  enableNotifications: true,
  notifyOnLowReadiness: true,
  enableCrashReporting: true,
};
```

---

### Colors

```typescript
const COLORS = {
  primary: '#1F2937',             // Dark gray
  secondary: '#6B7280',           // Medium gray
  accent: '#3B82F6',              // Blue
  success: '#10B981',             // Green
  warning: '#F59E0B',             // Amber
  error: '#EF4444',               // Red
  background: '#FFFFFF',          // White
  border: '#E5E7EB',              // Light gray
  text: '#111827',                // Dark text
  textSecondary: '#6B7280',       // Secondary text
} as const;
```

---

### Training Types

```typescript
type TrainingType = 'easy' | 'moderate' | 'hard' | 'rest';

const TRAINING_TYPES: TrainingType[] = ['easy', 'moderate', 'hard', 'rest'];

const TRAINING_INFO = {
  'easy': { label: 'Easy', emoji: '🚶', color: '#93C5FD' },
  'moderate': { label: 'Moderate', emoji: '🏃', color: '#FCD34D' },
  'hard': { label: 'Hard', emoji: '🏋️', color: '#FB7185' },
  'rest': { label: 'Rest', emoji: '🛌', color: '#C4B5FD' },
} as const;
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
