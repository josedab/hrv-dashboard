# API Reference

Complete reference for all public exports in the HRV Morning Readiness Dashboard.

---

## Table of Contents

- [Types & Interfaces](#types--interfaces)
- [Constants](#constants)
- [HRV Engine](#hrv-engine)
  - [Metrics](#metrics)
  - [Artifact Detection](#artifact-detection)
  - [Baseline Computation](#baseline-computation)
  - [Verdict Logic](#verdict-logic)
- [BLE Layer](#ble-layer)
  - [BLE Manager](#ble-manager)
  - [Heart Rate Parser](#heart-rate-parser)
  - [Permissions](#permissions)
  - [useBleRecording Hook](#useblerecording-hook)
- [Database](#database)
  - [Database Initialization](#database-initialization)
  - [Session Repository](#session-repository)
  - [Settings Repository](#settings-repository)
- [Utilities](#utilities)
  - [Date Utilities](#date-utilities)
  - [UUID Generator](#uuid-generator)
  - [CSV Export](#csv-export)
  - [Crash Reporting](#crash-reporting)
- [UI Components](#ui-components)
- [HRV Analytics](#hrv-analytics)
- [Orthostatic Test](#orthostatic-test)
- [Recovery Score](#recovery-score)
- [Camera PPG Processor](#camera-ppg-processor)
- [Encrypted Backup](#encrypted-backup)
- [Health Platform Sync](#health-platform-sync)
- [Notifications](#notifications)
- [Athlete Profiles](#athlete-profiles)
- [Widget Data](#widget-data)
- [Centralized Strings](#centralized-strings)

---

## Types & Interfaces

**Module:** `src/types/index.ts`

### `VerdictType`

```ts
type VerdictType = 'go_hard' | 'moderate' | 'rest';
```

Readiness verdict determined by comparing current rMSSD to baseline.

### `Session`

```ts
interface Session {
  id: string;              // UUID v4
  timestamp: string;       // ISO 8601 UTC
  durationSeconds: number;
  rrIntervals: number[];   // milliseconds
  rmssd: number;
  sdnn: number;
  meanHr: number;          // bpm
  pnn50: number;           // 0–100 percentage
  artifactRate: number;    // 0–1 fraction
  verdict: VerdictType | null;
  perceivedReadiness: number | null; // 1–5
  trainingType: string | null;
  notes: string | null;
  sleepHours: number | null;    // 0–24
  sleepQuality: number | null;  // 1–5
  stressLevel: number | null;   // 1–5
}
```

A complete HRV recording session with objective metrics and optional subjective log data (perceived readiness, training type, notes, sleep, and stress).

### `HrvMetrics`

```ts
interface HrvMetrics {
  rmssd: number;
  sdnn: number;
  meanHr: number;
  pnn50: number;
  artifactRate: number;
}
```

Computed HRV metrics returned by `computeHrvMetrics()`.

### `BaselineResult`

```ts
interface BaselineResult {
  median: number;    // median rMSSD over window
  dayCount: number;  // number of days with readings
  values: number[];  // daily rMSSD values used
}
```

Result of rolling baseline computation.

### `Settings`

```ts
interface Settings {
  baselineWindowDays: number;    // default: 7
  goHardThreshold: number;       // default: 0.95
  moderateThreshold: number;     // default: 0.80
  pairedDeviceId: string | null;
  pairedDeviceName: string | null;
}
```

### `DailyReading`

```ts
interface DailyReading {
  date: string;               // YYYY-MM-DD
  rmssd: number;
  verdict: VerdictType | null;
}
```

One rMSSD reading per day, used for baseline computation.

### `DEFAULT_SETTINGS`

```ts
const DEFAULT_SETTINGS: Settings = {
  baselineWindowDays: 7,
  goHardThreshold: 0.95,
  moderateThreshold: 0.80,
  pairedDeviceId: null,
  pairedDeviceName: null,
};
```

---

## Constants

### Colors (`src/constants/colors.ts`)

```ts
const COLORS: {
  goHard: '#22C55E';      // green
  moderate: '#F59E0B';    // amber
  rest: '#EF4444';        // red
  noVerdict: '#94A3B8';   // slate gray
  background: '#0F172A';  // dark navy
  surface: '#1E293B';
  surfaceLight: '#334155';
  text: '#F8FAFC';
  textSecondary: '#94A3B8';
  textMuted: '#7E8CA8';
  accent: '#3B82F6';      // blue
  border: '#334155';
  danger: '#EF4444';
  warning: '#F59E0B';
  success: '#22C55E';
};

const VERDICT_COLORS: Record<string, string>;
// Maps 'go_hard' | 'moderate' | 'rest' → hex color
```

### Strings (`src/constants/strings.ts`)

All user-facing text is centralized in the `STRINGS` constant for internationalization readiness. Includes static strings and template functions for dynamic content. Covers all screens and UI states.

```ts
const STRINGS: {
  appName: 'HRV Readiness';
  startReading: 'Start Reading';
  dayStreak: (n: number) => string;  // `🔥 ${n} day streak`
  // ... 100+ keys covering all screens
};
```

### Defaults (`src/constants/defaults.ts`)

| Constant | Value | Description |
|----------|-------|-------------|
| `MIN_RR_INTERVAL_MS` | `300` | Lower bound for physiologically plausible RR (~200 bpm) |
| `MAX_RR_INTERVAL_MS` | `2500` | Upper bound for physiologically plausible RR (~24 bpm) |
| `RECORDING_DURATION_SECONDS` | `300` | Full recording length (5 min) |
| `MIN_RECORDING_SECONDS` | `120` | Earliest early-finish (2 min) |
| `MIN_BASELINE_DAYS` | `5` | Days required for verdict |
| `ARTIFACT_WARNING_THRESHOLD` | `0.05` | Warn if artifact rate > 5% |
| `ARTIFACT_DEVIATION_FACTOR` | `0.20` | Flag RR deviating > 20% from local median |

```ts
const TRAINING_TYPES = ['Strength', 'BJJ', 'Cycling', 'Rest', 'Other'] as const;
type TrainingType = typeof TRAINING_TYPES[number];
```

### Verdict Info (`src/constants/verdicts.ts`)

```ts
interface VerdictInfo {
  key: VerdictType;
  label: string;
  description: string;
  emoji: string;
}

const VERDICT_INFO: Record<VerdictType, VerdictInfo>;
```

| Key | Label | Emoji | Description |
|-----|-------|-------|-------------|
| `go_hard` | Go Hard | 🟢 | HRV at or above baseline |
| `moderate` | Moderate | 🟡 | HRV within normal variance below baseline |
| `rest` | Rest or Easy | 🔴 | HRV significantly below baseline |

---

## HRV Engine

### Metrics

**Module:** `src/hrv/metrics.ts`

#### `computeHrvMetrics(rawRrIntervals)`

Main entry point. Automatically filters artifacts before computing metrics.

```ts
function computeHrvMetrics(rawRrIntervals: number[]): HrvMetrics
```

**Parameters:**
- `rawRrIntervals` — Array of RR intervals in milliseconds (may contain artifacts)

**Returns:** `HrvMetrics` with all computed values. Returns zeros for all fields if fewer than 2 intervals.

**Example:**
```ts
const metrics = computeHrvMetrics([800, 810, 795, 820, 805]);
// { rmssd: 14.57, sdnn: 8.49, meanHr: 74.07, pnn50: 0, artifactRate: 0 }
```

#### `computeRmssd(rrIntervals)`

Root Mean Square of Successive Differences — the primary metric for parasympathetic (vagal) tone and readiness assessment.

```ts
function computeRmssd(rrIntervals: number[]): number
```

**Formula:** `√(Σ(RR[i] - RR[i-1])² / (N-1))`

#### `computeSdnn(rrIntervals)`

Standard Deviation of NN intervals — measures overall HRV variability. Uses population std dev (÷ N), not sample std dev (÷ N-1).

```ts
function computeSdnn(rrIntervals: number[]): number
```

**Formula:** `√(Σ(RR[i] - mean)² / N)`

#### `computeMeanHr(rrIntervals)`

Average heart rate derived from RR intervals.

```ts
function computeMeanHr(rrIntervals: number[]): number
```

**Formula:** `60000 / mean(rrIntervals)` — result in beats per minute.

#### `computePnn50(rrIntervals)`

Percentage of successive RR interval differences exceeding 50 ms. Result is a percentage (0–100), not a fraction.

```ts
function computePnn50(rrIntervals: number[]): number
```

---

### Artifact Detection

**Module:** `src/hrv/artifacts.ts`

#### `detectArtifacts(rrIntervals, deviationFactor?)`

Flags RR intervals that deviate more than a threshold from the local 5-beat moving median.

```ts
function detectArtifacts(
  rrIntervals: number[],
  deviationFactor?: number  // default: 0.20
): boolean[]
```

**Parameters:**
- `rrIntervals` — Raw RR intervals in ms
- `deviationFactor` — Fractional deviation threshold (default 0.20 = 20%)

**Returns:** Boolean array of same length where `true` = artifact.

**Algorithm:**
1. For each interval, extract a window of ±2 surrounding beats
2. Compute median of the window
3. If `|RR - median| / median > deviationFactor`, flag as artifact
4. Arrays shorter than 5 elements return all `false` (no detection possible)

**Example:**
```ts
const artifacts = detectArtifacts([800, 810, 1200, 795, 805]);
// [false, false, true, false, false]  — 1200ms flagged
```

#### `filterArtifacts(rrIntervals)`

Removes artifact intervals and computes the artifact rate.

```ts
function filterArtifacts(rrIntervals: number[]): {
  cleanIntervals: number[];
  artifactRate: number;   // 0–1 fraction
  artifacts: boolean[];
}
```

---

### Baseline Computation

**Module:** `src/hrv/baseline.ts`

#### `computeBaseline(dailyReadings, windowDays?)`

Computes a rolling baseline using the **median** rMSSD over a configurable day window. The median is preferred over the mean for robustness to outliers.

```ts
function computeBaseline(
  dailyReadings: DailyReading[],
  windowDays?: number  // default: 7
): BaselineResult
```

**Parameters:**
- `dailyReadings` — Array of `DailyReading` (one rMSSD per day)
- `windowDays` — Number of days to include (default 7)

**Returns:** `BaselineResult` with median, day count, and raw values.

**Example:**
```ts
const baseline = computeBaseline(readings, 7);
// { median: 42.5, dayCount: 7, values: [38, 42, 45, 41, 43, 44, 40] }
```

#### `computeMedian(values)`

General-purpose median computation. Does not mutate the input array.

```ts
function computeMedian(values: number[]): number
```

---

### Verdict Logic

**Module:** `src/hrv/verdict.ts`

#### `computeVerdict(currentRmssd, baseline, settings?)`

Determines the readiness verdict by comparing the current rMSSD to the baseline median.

```ts
function computeVerdict(
  currentRmssd: number,
  baseline: BaselineResult,
  settings?: Settings  // default: DEFAULT_SETTINGS
): VerdictType | null
```

**Returns:**
- `null` if `baseline.dayCount < 5` or `baseline.median === 0`
- `'go_hard'` if `currentRmssd / baseline.median ≥ goHardThreshold` (default 0.95)
- `'moderate'` if ratio `≥ moderateThreshold` (default 0.80)
- `'rest'` if ratio `< moderateThreshold`

**Example:**
```ts
const baseline = { median: 40, dayCount: 7, values: [...] };
computeVerdict(42, baseline);  // 'go_hard'  (42/40 = 1.05 ≥ 0.95)
computeVerdict(35, baseline);  // 'moderate' (35/40 = 0.875 ≥ 0.80)
computeVerdict(28, baseline);  // 'rest'     (28/40 = 0.70 < 0.80)
computeVerdict(42, { median: 40, dayCount: 3, values: [] }); // null (< 5 days)
```

---

## BLE Layer

### BLE Manager

**Module:** `src/ble/bleManager.ts`

#### Types

```ts
type BleConnectionState = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'reconnecting' | 'error';

interface BleCallbacks {
  onStateChange: (state: BleConnectionState) => void;
  onHeartRateMeasurement: (measurement: HeartRateMeasurement) => void;
  onError: (error: string) => void;
}
```

#### `scanForDevices(onDeviceFound, timeoutMs?)`

Scans for BLE devices advertising Heart Rate Service (UUID `0000180d-...`). Auto-stops after timeout.

```ts
async function scanForDevices(
  onDeviceFound: (device: Device) => void,
  timeoutMs?: number  // default: 15000
): Promise<() => void>  // returns cleanup function
```

Deduplicates devices by ID. The returned function stops the scan and clears the timeout.

#### `connectAndSubscribe(deviceId, callbacks)`

Connects to a device, discovers services, and subscribes to Heart Rate Measurement notifications (UUID `00002a37-...`).

```ts
async function connectAndSubscribe(
  deviceId: string,
  callbacks: BleCallbacks
): Promise<() => void>  // returns cleanup function
```

Requests MTU of 512. Monitors disconnection events. The returned cleanup function removes the subscription and disconnects.

#### `connectWithRetry(deviceId, callbacks, maxAttempts?)`

Attempts to connect with exponential backoff retry. Retries up to `maxAttempts` times (default 3) on failure, with delays of 1s, 2s, 4s between attempts. Reports `'reconnecting'` state between attempts.

```ts
async function connectWithRetry(
  deviceId: string,
  callbacks: BleCallbacks,
  maxAttempts?: number  // default: 3
): Promise<() => void>  // returns cleanup function
```

**Throws:** The last connection error if all attempts fail.

#### `isBleAvailable()`

Checks if Bluetooth is powered on. Resolves `false` for PoweredOff or Unsupported states.

```ts
async function isBleAvailable(): Promise<boolean>
```

#### `isPolarH10(device)`

Checks if a device name starts with "Polar H10".

```ts
function isPolarH10(device: Device): boolean
```

#### `destroyManager()`

Destroys the singleton BLE manager instance. Call when the app is fully shutting down.

```ts
function destroyManager(): void
```

---

### Heart Rate Parser

**Module:** `src/ble/heartRateParser.ts`

#### `HeartRateMeasurement`

```ts
interface HeartRateMeasurement {
  heartRate: number;          // bpm
  rrIntervals: number[];      // ms (0, 1, or more per notification)
  energyExpended?: number;    // kJ (optional)
  sensorContact: boolean;     // true if contact confirmed or not supported
}
```

#### `isValidRrInterval(rrMs)`

Checks if an RR interval falls within the physiologically plausible range: 300 ms (~200 bpm) to 2500 ms (~24 bpm). Used to filter out implausible values during GATT parsing before they reach the HRV engine.

```ts
function isValidRrInterval(rrMs: number): boolean
```

#### `parseHeartRateMeasurement(data)`

Parses a Bluetooth GATT Heart Rate Measurement characteristic value (UUID 0x2A37) per the Bluetooth SIG specification.

```ts
function parseHeartRateMeasurement(data: Uint8Array): HeartRateMeasurement
```

**Byte layout:**
| Byte | Field | Notes |
|------|-------|-------|
| 0 | Flags | Bit 0: HR format, Bit 1-2: sensor contact, Bit 3: energy, Bit 4: RR |
| 1(+2) | Heart Rate | UINT8 or UINT16 depending on flag |
| varies | Energy Expended | UINT16, optional |
| varies | RR Intervals | UINT16 each, in 1/1024 sec units → converted to ms |

**Throws:** `Error` if data is shorter than 2 bytes.

#### `base64ToUint8Array(base64)`

Decodes base64-encoded BLE characteristic values (as provided by react-native-ble-plx) to `Uint8Array`.

```ts
function base64ToUint8Array(base64: string): Uint8Array
```

---

### Permissions

**Module:** `src/ble/permissions.ts`

#### `PermissionStatus`

```ts
type PermissionStatus = 'granted' | 'denied' | 'blocked';
```

#### `requestBlePermissions()`

Platform-aware BLE permission request:

```ts
async function requestBlePermissions(): Promise<PermissionStatus>
```

| Platform | Behavior |
|----------|----------|
| iOS | Returns `'granted'` — system dialog triggered automatically by BLE scan |
| Android 12+ (API 31+) | Requests `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT` |
| Android 10–11 (API 29–30) | Requests `ACCESS_FINE_LOCATION` with rationale dialog |
| Other | Returns `'granted'` |

#### `showPermissionBlockedAlert()`

Shows a native alert directing the user to system Settings when permissions are permanently denied.

```ts
function showPermissionBlockedAlert(): void
```

---

### useBleRecording Hook

**Module:** `src/ble/useBleRecording.ts`

```ts
function useBleRecording(): [RecordingState, RecordingActions]
```

Custom React hook managing the full BLE recording lifecycle: connection, timer, RR interval accumulation, and auto-stop.

#### `RecordingState`

```ts
interface RecordingState {
  connectionState: BleConnectionState;
  isRecording: boolean;
  rrIntervals: number[];     // accumulated RR intervals
  heartRates: number[];      // all HR readings
  currentHr: number;         // latest heart rate
  elapsedSeconds: number;
  remainingSeconds: number;  // countdown from 300
  canFinishEarly: boolean;   // true after 120 seconds
  error: string | null;
}
```

#### `RecordingActions`

```ts
interface RecordingActions {
  startRecording: (deviceId: string) => Promise<void>;
  stopRecording: () => void;
  resetRecording: () => void;
}
```

**Behavior:**
- `startRecording` — Resets state, connects to device via `connectWithRetry`, starts 1-second timer
- Auto-stops at `RECORDING_DURATION_SECONDS` (300s)
- `canFinishEarly` becomes `true` at `MIN_RECORDING_SECONDS` (120s)
- **Mid-recording reconnect** — If the device disconnects during a recording, the hook automatically calls `connectWithRetry` to re-establish the connection. Previously accumulated RR intervals are preserved. The `connectionState` transitions through `'reconnecting'` during this process.
- Cleanup on component unmount (stops timer, disconnects BLE)

---

## Database

### Database Initialization

**Module:** `src/database/database.ts`

#### `getDatabase()`

Returns the singleton SQLite database, creating it on first call. Runs migrations to create tables.

```ts
async function getDatabase(): Promise<SQLiteDatabase>
```

**Configuration:**
- Database name: `hrv_readiness.db`
- Journal mode: WAL
- Foreign keys: enabled
- Creates `sessions` and `settings` tables
- Creates index `idx_sessions_timestamp`

#### `closeDatabase()`

Closes the database connection and clears the singleton.

```ts
async function closeDatabase(): Promise<void>
```

---

### Session Repository

**Module:** `src/database/sessionRepository.ts`

#### `saveSession(session)`

Inserts a new session. RR intervals are stored as a JSON string.

```ts
async function saveSession(session: Session): Promise<void>
```

#### `updateSessionLog(sessionId, perceivedReadiness, trainingType, notes, sleepHours?, sleepQuality?, stressLevel?)`

Updates only the subjective log fields of an existing session.

```ts
async function updateSessionLog(
  sessionId: string,
  perceivedReadiness: number | null,
  trainingType: string | null,
  notes: string | null,
  sleepHours?: number | null,      // default: null
  sleepQuality?: number | null,    // default: null
  stressLevel?: number | null      // default: null
): Promise<void>
```

#### `getTodaySession(todayDateStr)`

Returns the first session recorded on the given date, or `null`.

```ts
async function getTodaySession(todayDateStr: string): Promise<Session | null>
```

#### `getAllSessions()`

Returns all sessions ordered by timestamp descending (newest first).

```ts
async function getAllSessions(): Promise<Session[]>
```

#### `getSessionsInRange(startDate, endDate)`

Returns sessions within a date range (inclusive), newest first.

```ts
async function getSessionsInRange(startDate: string, endDate: string): Promise<Session[]>
```

#### `getDailyReadings(windowDays)`

Returns one `DailyReading` per day for the last `windowDays` days. Uses the first reading of each day via `GROUP BY date(timestamp)`.

```ts
async function getDailyReadings(windowDays: number): Promise<DailyReading[]>
```

#### `getSessionDates()`

Returns distinct session dates (YYYY-MM-DD) for streak calculation.

```ts
async function getSessionDates(): Promise<string[]>
```

#### `getSessionsPaginated(limit, offset)`

Returns a paginated list of sessions, most recent first. Uses stable sort (`timestamp DESC, id DESC`) to avoid duplicates across pages.

```ts
async function getSessionsPaginated(limit: number, offset: number): Promise<Session[]>
```

#### `getSessionCount()`

Returns the total number of sessions in the database.

```ts
async function getSessionCount(): Promise<number>
```

#### `getSessionById(id)`

Returns a single session by UUID, or `null`.

```ts
async function getSessionById(id: string): Promise<Session | null>
```

#### `getRecentSessions(days)`

Returns sessions from the last N days, ordered by timestamp ascending.

```ts
async function getRecentSessions(days: number): Promise<Session[]>
```

---

### Settings Repository

**Module:** `src/database/settingsRepository.ts`

#### `loadSettings()`

Loads all settings from the database. Falls back to `DEFAULT_SETTINGS` for any missing keys. Parses numeric values (int for `baselineWindowDays`, float for thresholds).

```ts
async function loadSettings(): Promise<Settings>
```

#### `saveSetting(key, value)`

Saves a single setting (upsert).

```ts
async function saveSetting(key: keyof Settings, value: string): Promise<void>
```

#### `saveSettings(settings)`

Saves multiple settings at once. Skips `undefined` values.

```ts
async function saveSettings(settings: Partial<Settings>): Promise<void>
```

#### `validateThresholds(goHard, moderate)`

Validates that verdict threshold settings are logically consistent. Both values must be between 0 and 1, and `moderate` must be strictly less than `goHard`.

```ts
function validateThresholds(goHard: number, moderate: number): string | null
```

**Returns:** `null` if valid, or an error message string if invalid.

#### `clearPairedDevice()`

Deletes `pairedDeviceId` and `pairedDeviceName` from the settings table.

```ts
async function clearPairedDevice(): Promise<void>
```

---

## Utilities

### Date Utilities

**Module:** `src/utils/date.ts`

#### `toDateString(isoTimestamp)`

Extracts the date portion from an ISO timestamp.

```ts
function toDateString(isoTimestamp: string): string
// toDateString('2025-03-15T08:30:00Z') → '2025-03-15'
```

#### `todayString()`

Returns today's date as `YYYY-MM-DD` in local time.

```ts
function todayString(): string
```

#### `formatDuration(seconds)`

Formats a duration in seconds as `M:SS` or `MM:SS`.

```ts
function formatDuration(seconds: number): string
// formatDuration(185) → '3:05'
```

#### `formatDate(isoTimestamp)`

Formats as a human-readable date: `"Wed, Mar 15"`.

```ts
function formatDate(isoTimestamp: string): string
```

#### `formatDateTime(isoTimestamp)`

Formats as date and time: `"Wed, Mar 15, 8:30 AM"`.

```ts
function formatDateTime(isoTimestamp: string): string
```

#### `localDateString(date)`

Formats a `Date` object as `YYYY-MM-DD` in local time. Uses explicit year/month/day to avoid locale-dependent formatting.

```ts
function localDateString(date: Date): string
```

#### `daysAgo(n, from?)`

Returns a date N days before the given date (defaults to today), as `YYYY-MM-DD` in local time. Uses noon to avoid DST boundary issues.

```ts
function daysAgo(n: number, from?: Date): string
// daysAgo(7) → '2025-03-08' (if today is 2025-03-15)
```

#### `calculateStreak(dates)`

Computes the consecutive-day measurement streak ending at today or yesterday.

```ts
function calculateStreak(dates: string[]): number
```

Returns `0` if the most recent date is neither today nor yesterday. Handles duplicates and unsorted input.

---

### UUID Generator

**Module:** `src/utils/uuid.ts`

#### `generateId()`

Generates an RFC 4122 v4 UUID. Uses `crypto.randomUUID()` when available, falls back to `Math.random()`.

```ts
function generateId(): string
// '550e8400-e29b-41d4-a716-446655440000'
```

---

### CSV Export

**Module:** `src/utils/csv.ts`

#### `sessionsToCSV(sessions)`

Exports an array of sessions to CSV format with proper escaping.

```ts
function sessionsToCSV(sessions: Session[]): string
```

**Columns:** `id`, `timestamp`, `duration_seconds`, `rmssd` (2dp), `sdnn` (2dp), `mean_hr` (1dp), `pnn50` (1dp), `artifact_rate` (4dp), `verdict`, `perceived_readiness`, `training_type`, `notes`, `rr_interval_count`, `sleep_hours`, `sleep_quality`, `stress_level`

**Escaping:** Fields containing commas, double quotes, or newlines are wrapped in double quotes with internal quotes doubled.

---

### Crash Reporting

**Module:** `src/utils/crashReporting.ts`

Crash reporting utility backed by [Sentry](https://sentry.io). Initializes with the `SENTRY_DSN` or `EXPO_PUBLIC_SENTRY_DSN` environment variable. When no DSN is configured, all methods fall back to `console` logging — no crash in production if Sentry is not set up.

#### `initCrashReporting()`

Sets up Sentry error tracking (or console fallback). Idempotent — safe to call multiple times. Configures `tracesSampleRate: 0.2` and `enableAutoSessionTracking: true` when Sentry DSN is available. Called once during app initialization in `App.tsx`.

```ts
function initCrashReporting(): void
```

#### `reportError(error, context?)`

Logs an error with optional context metadata.

```ts
function reportError(error: Error | string, context?: Record<string, unknown>): void
```

#### `setUserContext(userId)`

Associates a user ID with subsequent error reports.

```ts
function setUserContext(userId: string): void
```

#### `addBreadcrumb(message, data?)`

Adds a breadcrumb for debugging context.

```ts
function addBreadcrumb(message: string, data?: Record<string, unknown>): void
```

---

## UI Components

**Module:** `src/components/`

| Component | Props | Description |
|-----------|-------|-------------|
| `VerdictDisplay` | `verdict: VerdictType \| null`, `rmssd: number`, `size?: 'large' \| 'small'` | Shows verdict emoji, label, rMSSD value, and description. Displays "Building Baseline" when verdict is null. |
| `Sparkline` | `data: number[]`, `width?`, `height?`, `color?`, `showBaseline?`, `baselineValue?` | Compact SVG line chart with optional dashed baseline overlay. Last point marked with circle. |
| `StatCard` | `label: string`, `value: string`, `unit?: string`, `warning?: boolean` | Metric card with optional warning border (used for high artifact rates). |
| `RRPlot` | `rrIntervals: number[]`, `width?`, `height?`, `maxPoints?` | Line chart of RR intervals (last 60 by default). Placeholder for < 2 data points. |
| `CountdownTimer` | `remainingSeconds: number`, `size?: number` | Circular SVG progress timer showing MM:SS. Includes accessibility labels. |
| `ReadinessSlider` | `value: number`, `onChange: (n: number) => void` | Five circular buttons for perceived readiness (1–5) with labels from "Very Low" to "Excellent". |
| `BreathingExercise` | `onComplete: () => void`, `onSkip: () => void` | Guided 4-7-8 breathing exercise with animated circle. Used pre-recording to calm the nervous system. |
| `Toast` | `message: string`, `visible: boolean` | Animated toast notification for transient feedback. |
| `ErrorBoundary` | `children: ReactNode` | Class component error boundary with recovery UI and crash reporting integration. |

---

## HRV Analytics

**Module:** `src/hrv/analytics.ts`

### `WeeklySummary`

```ts
interface WeeklySummary {
  avgRmssd: number;
  medianRmssd: number;
  avgHr: number;
  sessionCount: number;
  trendDirection: 'improving' | 'stable' | 'declining';
  trendPercent: number;
  bestDay: { date: string; rmssd: number } | null;
  worstDay: { date: string; rmssd: number } | null;
  verdictCounts: Record<VerdictType, number>;
  streakInPeriod: number;
}
```

### `computeWeeklySummary(currentSessions, previousSessions)`

Computes a weekly summary with trend direction relative to the previous period. Trend thresholds: >5% improvement, <-5% declining, otherwise stable.

```ts
function computeWeeklySummary(
  currentSessions: Session[],
  previousSessions: Session[]
): WeeklySummary
```

### `CorrelationResult`

```ts
interface CorrelationResult {
  factor: string;            // e.g. "Sleep Quality"
  correlation: number;       // Pearson r (-1 to 1)
  sampleSize: number;
  interpretation: string;    // Human-readable interpretation
}
```

### `computeSleepHrvCorrelation(sessions)`

Pearson correlation between sleep quality (1–5) and rMSSD. Returns `null` if fewer than 5 paired observations.

```ts
function computeSleepHrvCorrelation(sessions: Session[]): CorrelationResult | null
```

### `computeStressHrvCorrelation(sessions)`

Pearson correlation between stress level (1–5) and rMSSD. Returns `null` if fewer than 5 paired observations.

```ts
function computeStressHrvCorrelation(sessions: Session[]): CorrelationResult | null
```

---

## Orthostatic Test

**Module:** `src/hrv/orthostatic.ts`

### `OrthostaticResult`

```ts
interface OrthostaticResult {
  supine: HrvMetrics;
  standing: HrvMetrics;
  deltaRmssd: number;        // Change in rMSSD (typically negative)
  deltaHr: number;            // Change in HR (typically positive)
  reactivityScore: number;    // 0–100
  interpretation: string;
}
```

### `computeOrthostaticResult(supineRrIntervals, standingRrIntervals)`

Computes orthostatic test results from supine and standing RR intervals. A healthy response shows rMSSD drop of 15–40% and HR increase of 10–30 bpm.

```ts
function computeOrthostaticResult(
  supineRrIntervals: number[],
  standingRrIntervals: number[]
): OrthostaticResult
```

**Reactivity scoring:** Optimal is ~25% rMSSD drop + ~15 bpm HR rise. Weighted 60% HRV reactivity, 40% HR reactivity.

**Interpretations:**
| Condition | Interpretation |
|-----------|----------------|
| rMSSD drop <10%, HR rise <5 bpm | Blunted — possible overtraining |
| rMSSD drop >50% or HR rise >35 bpm | Exaggerated — possible dehydration/fatigue |
| rMSSD drop 15–40%, HR rise 10–30 bpm | Normal autonomic reactivity |
| Other | Atypical — monitor trend |

---

## Recovery Score

**Module:** `src/hrv/recovery.ts`

### `RecoveryScore`

```ts
interface RecoveryScore {
  score: number;              // 0–100
  label: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  components: {
    hrv: number;              // 0–100
    sleep: number;            // 0–100
    stress: number;           // 0–100
    readiness: number;        // 0–100
  };
}
```

### `computeRecoveryScore(session, baseline)`

Composite recovery score combining objective HRV with subjective inputs. Returns `null` if baseline has fewer than 5 days or median is 0.

```ts
function computeRecoveryScore(
  session: Session,
  baseline: BaselineResult
): RecoveryScore | null
```

**Component weights:**
| Component | Weight | Source | Notes |
|-----------|--------|--------|-------|
| HRV ratio | 40% | `rMSSD / baseline.median` | Capped at 120% |
| Sleep quality | 25% | `session.sleepQuality` (1–5) | 50 if not logged |
| Stress (inverse) | 20% | `session.stressLevel` (1–5) | Inverted; 50 if not logged |
| Perceived readiness | 15% | `session.perceivedReadiness` (1–5) | 50 if not logged |

### `estimateTrainingLoad(session)`

Estimates daily training load from training type intensity × perceived effort. Returns 0 if no training type is set.

```ts
function estimateTrainingLoad(session: Session): number
```

**Intensity map:** Strength (7), BJJ (8), Cycling (6), Rest (1), Other (5).

### `computeWeeklyLoad(sessions)`

Sums estimated training load across a week of sessions.

```ts
function computeWeeklyLoad(sessions: Session[]): number
```

---

## Camera PPG Processor

**Module:** `src/ble/ppgProcessor.ts`

### `PpgConfig`

```ts
interface PpgConfig {
  fps: number;                   // Camera frame rate (default: 30)
  minDurationSeconds: number;    // Minimum recording length (default: 60)
  qualityThreshold: number;      // Quality threshold 0–1 (default: 0.6)
}
```

### `PpgResult`

```ts
interface PpgResult {
  rrIntervals: number[];        // Extracted RR intervals in ms
  signalQuality: number;        // 0–1
  isUsable: boolean;            // quality ≥ threshold && ≥ 30 RR intervals
  estimatedHr: number;          // bpm
  beatCount: number;
}
```

### `processPpgSignal(brightnessValues, timestamps, config?)`

Processes raw camera frame brightness values into RR intervals via peak detection.

```ts
function processPpgSignal(
  brightnessValues: number[],
  timestamps: number[],
  config?: PpgConfig
): PpgResult
```

**Pipeline:** Normalize → moving average smoothing → local maxima peak detection → inter-beat interval computation → physiological range validation → quality assessment.

**Returns** empty result if: fps ≤ 0, array lengths mismatch, or fewer than 10 seconds of data.

---

## Encrypted Backup

**Module:** `src/utils/backup.ts`

### `createBackup(passphrase)`

Creates an encrypted backup of all sessions and user settings, then opens the system share sheet.

```ts
async function createBackup(passphrase: string): Promise<void>
```

**Throws:** If passphrase is shorter than 4 characters.

**Encryption:** SHA-256 CTR stream cipher. Key derived via 1000 iterations of SHA-256 with random 16-byte salt. 12-byte random IV. Integrity verified via SHA-256 hash of plaintext.

**File format:** `.hrvbak` — JSON envelope containing `{ v, salt, iv, integrity, data }`.

### `restoreBackup(fileUri, passphrase)`

Restores sessions from an encrypted backup file. Validates integrity after decryption. Imports only sessions not already in the database (by UUID). Restores user settings but preserves internal state keys.

```ts
async function restoreBackup(fileUri: string, passphrase: string): Promise<number>
```

**Returns:** Number of new sessions imported.

**Throws:** On invalid format, version mismatch, wrong passphrase (detected via integrity check), or corrupt data.

---

## Health Platform Sync

**Module:** `src/utils/healthSync.ts`

Platform-aware integration with Apple HealthKit (iOS) and Android Health Connect. The SDK modules are loaded at runtime — the app works without them installed.

### `isHealthSyncAvailable()`

Checks if the health SDK is installed and the platform supports it.

```ts
function isHealthSyncAvailable(): boolean
```

### `requestHealthPermissions()`

Requests write permissions for HRV and heart rate data from the platform health store.

```ts
async function requestHealthPermissions(): Promise<boolean>
```

### `syncSessionToHealth(session)`

Writes a single session's HRV and heart rate data to the platform health store. iOS writes SDNN (HealthKit standard); Android writes rMSSD (Health Connect standard).

```ts
async function syncSessionToHealth(session: Session): Promise<boolean>
```

### `syncAllPendingSessions(sessions)`

Syncs all un-synced sessions. Tracks synced IDs in the settings table to avoid duplicate writes.

```ts
async function syncAllPendingSessions(sessions: Session[]): Promise<number>
```

### `loadHealthSyncSettings()` / `setHealthSyncEnabled(enabled)`

```ts
async function loadHealthSyncSettings(): Promise<HealthSyncSettings>
async function setHealthSyncEnabled(enabled: boolean): Promise<void>
```

---

## Notifications

**Module:** `src/utils/notifications.ts`

Push notification support for morning reminders and streak protection via `expo-notifications`.

### `NotificationSettings`

```ts
interface NotificationSettings {
  morningReminderEnabled: boolean;
  morningReminderHour: number;     // 0–23
  morningReminderMinute: number;   // 0–59
  streakReminderEnabled: boolean;
}
```

### `scheduleMorningReminder(hour, minute)`

Schedules a daily notification at the specified time. Cancels any existing morning reminder first.

```ts
async function scheduleMorningReminder(hour: number, minute: number): Promise<void>
```

### `scheduleStreakReminder(currentStreak)`

Schedules a daily 10 AM reminder if the user has a streak ≥ 2 days.

```ts
async function scheduleStreakReminder(currentStreak: number): Promise<void>
```

### `cancelAllReminders()` / `requestNotificationPermissions()`

```ts
async function cancelAllReminders(): Promise<void>
async function requestNotificationPermissions(): Promise<boolean>
```

### `loadNotificationSettings()` / `saveNotificationSettings(settings)`

Load and persist notification settings via the `settings` table (keys prefixed with `notification_`).

```ts
async function loadNotificationSettings(): Promise<NotificationSettings>
async function saveNotificationSettings(settings: NotificationSettings): Promise<void>
```

---

## Athlete Profiles

**Module:** `src/utils/profiles.ts`

Multi-athlete profile support with a dedicated `profiles` table (created lazily).

### `AthleteProfile`

```ts
interface AthleteProfile {
  id: string;          // UUID v4
  name: string;
  isActive: boolean;
  createdAt: string;
}
```

### Profile CRUD

```ts
async function getProfiles(): Promise<AthleteProfile[]>
async function createProfile(name: string): Promise<AthleteProfile>
async function setActiveProfile(profileId: string): Promise<void>
async function deleteProfile(profileId: string): Promise<void>
```

**Constraints:** Profile name must be 1–100 characters. Only one profile can be active at a time (switching deactivates all others).

### `shareVerdict(session)`

Formats and shares today's verdict as a text message via the system share sheet.

```ts
async function shareVerdict(session: Session): Promise<void>
```

---

## Widget Data

**Module:** `src/utils/widgetData.ts`

Provides data for iOS WidgetKit / Android Glance home screen widgets.

### `WidgetData`

```ts
interface WidgetData {
  hasReading: boolean;
  verdict: string | null;
  rmssd: number | null;
  baselineMedian: number | null;
  percentOfBaseline: number | null;
  streak: number;
  sparklineValues: number[];        // Last 7 rMSSD values
  dateLabel: string;
  updatedAt: string;                // ISO 8601
}
```

### `getWidgetData()`

Gathers all data needed for the widget display. Called after each recording and on app launch.

```ts
async function getWidgetData(): Promise<WidgetData>
```

### `refreshWidget()`

Convenience function: gathers widget data and persists it for native widget access.

```ts
async function refreshWidget(): Promise<void>
```

---

## Centralized Strings

**Module:** `src/constants/strings.ts`

All user-facing UI text is centralized in the `STRINGS` constant for i18n readiness. String values include static strings and template functions (e.g., `dayStreak: (n) => \`🔥 ${n} day streak\``). Covers all screens: Home, Reading, Breathing, History, Trends, Log, Settings, Backup, Onboarding, Orthostatic, Camera, and error states.
