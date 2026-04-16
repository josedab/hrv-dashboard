---
sidebar_position: 3
---

# Database

The Database module provides persistent storage for sessions, settings, and user preferences using SQLite with WAL mode for concurrent access. All operations are async and handle migrations automatically.

## Initialization

### getDatabase

Retrieves or creates the singleton SQLite database instance.

```typescript
getDatabase(): Promise<SQLiteDatabase>
```

**Returns:**
- Promise resolving to `SQLiteDatabase` instance

**Behavior:**
- Runs all pending migrations on first call
- Enables WAL (Write-Ahead Logging) mode for performance
- Singleton pattern ensures only one active connection

**Example:**
```typescript
const db = await getDatabase();
```

---

### closeDatabase

Closes the database connection and cleans up resources.

```typescript
closeDatabase(): Promise<void>
```

**Use when:** App terminates or you need to reset state.

---

## Sessions

### saveSession

Inserts a new session record.

```typescript
saveSession(session: Session): Promise<void>
```

**Parameters:**
- `session` — Complete Session object with all required fields

**Returns:**
- Promise (void)

**Required Session Fields:**
- `id` — Unique identifier (RFC 4122 v4)
- `date` — Session date (YYYY-MM-DD)
- `rrIntervals` — Recorded R-R intervals (number[])
- `rmssd`, `sdnn`, `meanHr`, `pnn50` — Computed metrics

**Optional Fields:**
- `perceivedReadiness` — 1–5 scale
- `trainingType` — 'easy' | 'moderate' | 'hard' | 'rest'
- `notes` — User notes
- `sleepHours`, `sleepQuality`, `stressLevel` — Health context

---

### updateSessionLog

Updates logging fields of an existing session without re-recording.

```typescript
updateSessionLog(
  sessionId: string,
  perceivedReadiness: number,
  trainingType: string,
  notes: string,
  sleepHours?: number,
  sleepQuality?: number,
  stressLevel?: number
): Promise<void>
```

**Parameters:**
- `sessionId` — Session ID to update
- `perceivedReadiness` — 1–5 scale
- `trainingType` — 'easy' | 'moderate' | 'hard' | 'rest'
- `notes` — User notes
- `sleepHours` — Hours of sleep (optional)
- `sleepQuality` — 1–5 scale (optional)
- `stressLevel` — 1–5 scale (optional)

**Returns:**
- Promise (void)

---

### getTodaySession

Fetches today's recording session if it exists.

```typescript
getTodaySession(todayDateStr: string): Promise<Session | null>
```

**Parameters:**
- `todayDateStr` — Today's date as YYYY-MM-DD

**Returns:**
- `Session` if found, `null` otherwise

**Example:**
```typescript
const today = todayString(); // e.g., "2024-01-15"
const session = await getTodaySession(today);
if (session) {
  console.log(`Today RMSSD: ${session.rmssd}`);
}
```

---

### getAllSessions

Fetches all recorded sessions, ordered newest first.

```typescript
getAllSessions(): Promise<Session[]>
```

**Returns:**
- Array of all Session objects

**Note:** Use `getSessionsPaginated` for large datasets.

---

### getSessionsPaginated

Fetches sessions with pagination.

```typescript
getSessionsPaginated(
  limit: number,
  offset: number
): Promise<Session[]>
```

**Parameters:**
- `limit` — Number of sessions per page (e.g., 20)
- `offset` — Starting index (0 for first page)

**Returns:**
- Array of Session objects

**Example:**
```typescript
// Fetch page 1 (newest 20 sessions)
const sessions = await getSessionsPaginated(20, 0);

// Fetch page 2
const nextPage = await getSessionsPaginated(20, 20);
```

---

### getSessionCount

Returns total number of recorded sessions.

```typescript
getSessionCount(): Promise<number>
```

**Returns:**
- Total count as number

---

### getSessionsInRange

Fetches sessions within a date range.

```typescript
getSessionsInRange(
  startDate: string,
  endDate: string
): Promise<Session[]>
```

**Parameters:**
- `startDate` — Start date (YYYY-MM-DD, inclusive)
- `endDate` — End date (YYYY-MM-DD, inclusive)

**Returns:**
- Array of Session objects in chronological order

**Example:**
```typescript
const week = await getSessionsInRange("2024-01-08", "2024-01-15");
```

---

### getSessionDates

Fetches all unique session dates.

```typescript
getSessionDates(): Promise<string[]>
```

**Returns:**
- Array of dates (YYYY-MM-DD) in ascending order

---

### getSessionById

Fetches a specific session by ID.

```typescript
getSessionById(id: string): Promise<Session | null>
```

**Parameters:**
- `id` — Session UUID

**Returns:**
- `Session` if found, `null` otherwise

---

### getRecentSessions

Fetches the N most recent sessions.

```typescript
getRecentSessions(days: number): Promise<Session[]>
```

**Parameters:**
- `days` — Look-back period in days (e.g., 28 for 4 weeks)

**Returns:**
- Array of Session objects from the past N days, newest first

---

## Daily Readings

### getDailyReadings

Aggregates daily HRV metrics for trend analysis (typically for baseline calculation).

```typescript
getDailyReadings(windowDays: number): Promise<DailyReading[]>
```

**Parameters:**
- `windowDays` — Look-back window (e.g., 28 days)

**Returns:**
```typescript
DailyReading[] = [
  {
    date: string;              // YYYY-MM-DD
    rmssd: number;             // Daily average or median
    sdnn?: number;
    meanHr?: number;
    sessionCount: number;      // Number of recordings that day
  },
  // ...
]
```

**Returns:**
- Array of aggregated daily readings, oldest first

**Example:**
```typescript
const readings = await getDailyReadings(28);
const baseline = computeBaseline(readings);
```

---

## Settings

### loadSettings

Retrieves the user's current settings.

```typescript
loadSettings(): Promise<Settings>
```

**Returns:**
- `Settings` object with all configuration

---

### saveSetting

Updates a single setting by key.

```typescript
saveSetting(key: string, value: unknown): Promise<void>
```

**Parameters:**
- `key` — Setting key (e.g., `'goHardThreshold'`)
- `value` — New value (string, number, boolean, or JSON)

**Returns:**
- Promise (void)

---

### saveSettings

Updates multiple settings at once.

```typescript
saveSettings(settings: Partial<Settings>): Promise<void>
```

**Parameters:**
- `settings` — Partial Settings object with fields to update

**Returns:**
- Promise (void)

**Example:**
```typescript
await saveSettings({
  goHardThreshold: 1.5,
  moderateThreshold: 0.75,
  pairedDeviceId: 'ABC123',
});
```

---

### validateThresholds

Validates readiness threshold settings.

```typescript
validateThresholds(
  goHard: number,
  moderate: number
): string | null
```

**Parameters:**
- `goHard` — Go Hard threshold multiplier
- `moderate` — Moderate threshold multiplier

**Returns:**
- Error message (string) if invalid, `null` if valid

**Validation Rules:**
- Both must be positive numbers
- `moderate < goHard` (moderate is lower bound)
- Typically: `0.5 < moderate < goHard < 2.0`

---

## Paired Devices

### clearPairedDevice

Clears the stored paired BLE device ID.

```typescript
clearPairedDevice(): Promise<void>
```

**Returns:**
- Promise (void)

**Use when:** User unpairs a device or wants to scan for a new one.

---

## Types

See [Types & Constants](./types.md) for `Session`, `DailyReading`, and `Settings` interface definitions.

---

## Database Schema

The database automatically creates and maintains:

- **sessions** table: Recording data and metrics
- **settings** table: User preferences and configuration
- **daily_readings** view: Aggregated daily statistics (auto-computed from sessions)

Migrations are version-controlled and applied automatically on app startup.
