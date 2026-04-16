---
sidebar_position: 4
---

# Utilities

Utility modules provide helper functions for date/time manipulation, unique ID generation, data export, and error tracking.

## Date Utilities

All date functions work with YYYY-MM-DD format strings and handle timezone considerations for local dates.

### toDateString

Converts a Date object to YYYY-MM-DD string in local time.

```typescript
toDateString(date: Date): string
```

**Parameters:**
- `date` — JavaScript Date object

**Returns:**
- ISO-like date string (YYYY-MM-DD) in local timezone

**Example:**
```typescript
const dateStr = toDateString(new Date('2024-01-15T10:30:00'));
// Returns: "2024-01-15"
```

---

### todayString

Returns today's date as YYYY-MM-DD.

```typescript
todayString(): string
```

**Returns:**
- Today's date in YYYY-MM-DD format (local timezone)

---

### localDateString

Converts a YYYY-MM-DD string to a human-readable local date string.

```typescript
localDateString(dateStr: string): string
```

**Parameters:**
- `dateStr` — Date as YYYY-MM-DD

**Returns:**
- Localized date string (e.g., "Jan 15, 2024")

---

### formatDuration

Formats elapsed seconds as HH:MM:SS or MM:SS.

```typescript
formatDuration(seconds: number): string
```

**Parameters:**
- `seconds` — Elapsed time in seconds

**Returns:**
- Formatted duration string

**Example:**
```typescript
formatDuration(125);    // "2:05"
formatDuration(3665);   // "1:01:05"
```

---

### formatDate

Formats YYYY-MM-DD as a short date (e.g., "Jan 15").

```typescript
formatDate(dateStr: string): string
```

**Parameters:**
- `dateStr` — Date as YYYY-MM-DD

**Returns:**
- Short formatted date (locale-aware)

---

### formatDateTime

Formats YYYY-MM-DD with time as full datetime string.

```typescript
formatDateTime(dateStr: string, timeStr?: string): string
```

**Parameters:**
- `dateStr` — Date as YYYY-MM-DD
- `timeStr` — Time as HH:MM (optional)

**Returns:**
- Full datetime string (e.g., "Monday, January 15, 2024 10:30 AM")

---

### daysAgo

Calculates a date N days in the past.

```typescript
daysAgo(days: number): string
```

**Parameters:**
- `days` — Number of days to subtract from today

**Returns:**
- Date in YYYY-MM-DD format

**Example:**
```typescript
daysAgo(7);  // Returns date 7 days ago
```

---

### calculateStreak

Calculates consecutive recording streak length.

```typescript
calculateStreak(sessionDates: string[]): number
```

**Parameters:**
- `sessionDates` — Array of YYYY-MM-DD strings from sessions

**Returns:**
- Number of consecutive days with recordings (counting today if present)

**Example:**
```typescript
const streak = calculateStreak([
  "2024-01-13",
  "2024-01-14",
  "2024-01-15"
]);
// Returns: 3
```

---

## UUID Generation

### generateId

Generates a RFC 4122 v4 UUID string.

```typescript
generateId(): string
```

**Returns:**
- UUID string in format `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`

**Example:**
```typescript
const sessionId = generateId();
// e.g., "a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6"
```

---

## CSV Export

### sessionsToCSV

Exports sessions to CSV format.

```typescript
sessionsToCSV(sessions: Session[]): string
```

**Parameters:**
- `sessions` — Array of Session objects to export

**Returns:**
- CSV string with header row and data rows

**Columns:**
- Date
- RMSSD (ms)
- SDNN (ms)
- Mean HR (bpm)
- PNN50 (%)
- Perceived Readiness
- Training Type
- Sleep Hours
- Sleep Quality
- Stress Level
- Notes

**Example:**
```typescript
const sessions = await getAllSessions();
const csv = sessionsToCSV(sessions);
// Can be saved to file or shared
```

---

## Crash Reporting

Crash reporting provides error tracking and analytics integration, with console fallback if external service unavailable.

### initCrashReporting

Initializes crash reporting with optional Sentry integration.

```typescript
initCrashReporting(
  sentryDsn?: string,
  environment?: 'production' | 'staging' | 'development'
): void
```

**Parameters:**
- `sentryDsn` — Sentry DSN URL (optional; if omitted, uses console logging)
- `environment` — Environment label (default: 'production')

**Behavior:**
- Initializes Sentry if DSN provided
- Sets up global error handlers
- Logs errors to console if Sentry unavailable

**Example:**
```typescript
initCrashReporting(
  'https://examplePublicKey@o0.ingest.sentry.io/0',
  'production'
);
```

---

### reportError

Reports an error to crash tracking service.

```typescript
reportError(
  error: Error | string,
  context?: Record<string, unknown>
): void
```

**Parameters:**
- `error` — Error object or message string
- `context` — Additional context data (optional)

**Behavior:**
- Sends to Sentry if configured
- Logs to console as fallback

**Example:**
```typescript
try {
  await connectDevice(deviceId);
} catch (error) {
  reportError(error, {
    deviceId,
    attemptNumber: 2,
  });
}
```

---

### setUserContext

Associates error reports with a user.

```typescript
setUserContext(userId: string): void
```

**Parameters:**
- `userId` — Unique user identifier

**Behavior:**
- Future error reports will include this user ID
- Useful for correlating issues to specific users

**Example:**
```typescript
const userId = await loadUserId();
setUserContext(userId);
```

---

### addBreadcrumb

Records a breadcrumb (event history) for debugging.

```typescript
addBreadcrumb(
  message: string,
  data?: Record<string, unknown>,
  level?: 'debug' | 'info' | 'warning' | 'error'
): void
```

**Parameters:**
- `message` — Breadcrumb description
- `data` — Associated data (optional)
- `level` — Severity level (default: 'info')

**Behavior:**
- Stores breadcrumbs locally
- Includes breadcrumbs in error reports for context
- Most recent breadcrumbs sent with next error

**Example:**
```typescript
addBreadcrumb('Device connected', { deviceId, signal: -45 }, 'info');
addBreadcrumb('Parsing HR data', { byteLength: 12 }, 'debug');
// If error occurs next, these breadcrumbs help with debugging
```

---

## Import Patterns

```typescript
// Date utilities
import {
  toDateString,
  todayString,
  localDateString,
  formatDuration,
  formatDate,
  formatDateTime,
  daysAgo,
  calculateStreak,
} from 'src/utils/dateUtils';

// UUID
import { generateId } from 'src/utils/uuid';

// CSV
import { sessionsToCSV } from 'src/utils/csv';

// Crash Reporting
import {
  initCrashReporting,
  reportError,
  setUserContext,
  addBreadcrumb,
} from 'src/utils/crashReporting';
```
