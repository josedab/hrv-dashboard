---
sidebar_position: 8
---

# Integrations API

API reference for health platform sync, data import, workout export, and related integrations.

## Health Two-Way Sync

**Module:** `src/integrations/healthTwoWay.ts`

### requestHealthAccess

Unified read + write permission request for HealthKit/Health Connect.

```typescript
requestHealthAccess(): Promise<boolean>
```

### pullForReading

Auto-pulls sleep data and resting HR before a morning recording.

```typescript
pullForReading(now?: Date): Promise<TwoWayPull>
```

**Returns:**
```typescript
interface TwoWayPull {
  sleepHours: number | null;
  restingHr: number | null;
  autoPullResult: AutoPullResult;
}
```

### syncBoth

Merges pulled data with session and pushes HRV metrics back to health platform.

```typescript
syncBoth(session: Session, pulled: TwoWayPull): Promise<void>
```

---

## CSV Import

### Import Wizard

**Module:** `src/integrations/import/wizard.ts`

#### parseImport

Dispatches to vendor-specific parser based on source.

```typescript
parseImport(source: ImportSource, content: string): ImportedSession[]
```

#### planImport

Plans an import with collision detection against existing data.

```typescript
planImport(
  source: ImportSource,
  content: string,
  getExistingIds: () => Promise<Set<string>>
): Promise<ImportPreview>
```

**Returns:**
```typescript
interface ImportPreview {
  sessions: ImportedSession[];
  newCount: number;
  skipCount: number;      // Already exists
  conflictCount: number;  // Exists with different data
}
```

#### commitImport

Imports sessions with per-row error handling.

```typescript
commitImport(
  preview: ImportPreview,
  saveSession: (s: Session) => Promise<void>
): Promise<ImportCommitResult>
```

### Vendor Parsers

**Module:** `src/integrations/import/vendors.ts`

```typescript
type ImportSource = 'whoop' | 'oura' | 'garmin' | 'elite_hrv' | 'hrv4training';
```

| Parser | Input | Key Fields |
|--------|-------|-----------|
| `parseWhoopCsv(csv)` | Whoop CSV | Cycle time, HRV (ms), resting HR, recovery % |
| `parseOuraJson(json)` | Oura JSON | Daily readiness, sleep, HRV |
| `parseGarminCsv(csv)` | Garmin CSV | Date, rMSSD, SDNN, avg HR |

#### registerParser

Add support for a custom vendor:

```typescript
registerParser(
  source: string,
  parser: (content: string) => ImportedSession[]
): void
```

**Session ID format:** Deterministic UUID from `${source}:${externalId}` (prevents duplicates on re-import).

---

## Workout Export

### Generator

**Module:** `src/workout/generator.ts`

```typescript
type SportProfile = 'cycling' | 'running' | 'strength' | 'bjj' | 'rest_day';

generateWorkout(opts: {
  verdict: VerdictType;
  sport: SportProfile;
  tsb?: TsbPoint;
}): WorkoutPrescription

toZwoXml(workout: WorkoutPrescription, athleteName?: string): string
```

### Exporters

**Module:** `src/workout/exporters.ts`

```typescript
pushToStrava(workout: WorkoutPrescription, date: string, config: StravaConfig): Promise<void>
pushToTrainingPeaks(workout: WorkoutPrescription, date: string, athleteId: string, config: TPConfig): Promise<void>
pushToIntervalsIcu(workout: WorkoutPrescription, date: string, athleteId: string, config: IcuConfig): Promise<void>

renderPlainText(workout: WorkoutPrescription): string
renderIntervalsDoc(workout: WorkoutPrescription): object
```

---

## Sleep Architecture

**Module:** `src/hrv/sleepArchitecture.ts`

```typescript
type SleepStage = 'awake' | 'rem' | 'light' | 'deep';

buildHypnogram(samples: SleepSample[]): SleepArchitecture | null

correlateSleepHrv(
  architecture: SleepArchitecture,
  nextMorningRmssd: number,
  avgRmssd: number
): SleepHrvCorrelation
```

**SleepArchitecture:**
- Stage percentages, restorativePercent (REM + Deep), sleepEfficiency, wakeEpisodes

---

## Notifications

**Module:** `src/utils/notifications.ts`

```typescript
requestNotificationPermissions(): Promise<boolean>
scheduleMorningReminder(hour: number, minute: number): Promise<void>
scheduleStreakReminder(streak: number): Promise<void>
scheduleWeeklyDigest(trend: string, streak: number): Promise<void>
inferRecordingTime(timestamps: string[]): { hour: number; minute: number }
loadNotificationSettings(): Promise<NotificationSettings>
saveNotificationSettings(settings: NotificationSettings): Promise<void>
```

---

## Report Generation

**Module:** `src/utils/reportGenerator.ts`

```typescript
type ReportPeriod = 'weekly' | 'monthly';

buildReportData(sessions: Session[], baseline: BaselineResult, period: ReportPeriod, streak: number): ReportData
renderReportHtml(data: ReportData): string  // Self-contained HTML with inline CSS
```

---

## Shareable Cards

**Module:** `src/utils/shareCard.ts`

```typescript
renderShareCardHtml(data: ShareCardData): string   // 600×340px branded card
renderShareText(data: ShareCardData): string        // Plain-text fallback
```

---

## Widget Data

**Module:** `src/utils/widgetData.ts`

```typescript
getWidgetData(): Promise<WidgetData>       // Gather all widget info
updateNativeWidget(data: WidgetData): Promise<void>  // Persist for native bridge
refreshWidget(): Promise<void>             // Call after session save
```

**WidgetData:** `hasReading`, `verdict`, `rmssd`, `baselineMedian`, `percentOfBaseline`, `streak`, `sparklineValues` (last 7), `dateLabel`
