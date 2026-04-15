# Architecture Overview

This document describes the architecture, data flow, and key design decisions of the HRV Morning Readiness Dashboard.

## System Overview

The app follows a layered architecture with clear separation between BLE communication, HRV computation, data persistence, and presentation.

```mermaid
graph TB
    subgraph Presentation["Presentation Layer"]
        Home[HomeScreen]
        Reading[ReadingScreen]
        History[HistoryScreen]
        Log[LogScreen]
        Settings[SettingsScreen]
        Detail[SessionDetailScreen]
        Onboarding[OnboardingScreen]
        Privacy[PrivacyPolicyScreen]
    end

    subgraph Components["UI Components"]
        Verdict[VerdictDisplay]
        Sparkline[Sparkline]
        StatCard[StatCard]
        RRPlot[RRPlot]
        Timer[CountdownTimer]
        Slider[ReadinessSlider]
        ErrorBound[ErrorBoundary]
    end

    subgraph Navigation["Navigation"]
        AppNav[AppNavigator]
        Tabs[Bottom Tabs]
        Stack[Modal Stack]
    end

    subgraph Domain["Domain Layer"]
        Metrics[HRV Metrics]
        Artifacts[Artifact Detection]
        Baseline[Baseline Computation]
        VerdictLogic[Verdict Logic]
    end

    subgraph BLE["BLE Layer"]
        BleManager[BLE Manager]
        Parser[HR Parser]
        Permissions[Permissions]
        Hook[useBleRecording]
    end

    subgraph Data["Data Layer"]
        DB[SQLite Database]
        SessionRepo[Session Repository]
        SettingsRepo[Settings Repository]
    end

    subgraph External["External"]
        PolarH10[Polar H10 / HR Monitor]
    end

    Home --> Verdict & Sparkline & StatCard
    Reading --> Hook & Timer & RRPlot
    History --> Sparkline & Detail
    Log --> Slider & Verdict

    Hook --> BleManager --> Parser
    BleManager --> PolarH10
    Hook --> Permissions

    Reading -->|Save session| SessionRepo
    Home -->|Load today| SessionRepo
    Home -->|Load baseline| SessionRepo
    History -->|Load all| SessionRepo
    Settings --> SettingsRepo

    SessionRepo --> DB
    SettingsRepo --> DB

    Home -->|Compute| Baseline --> VerdictLogic
    Reading -->|Compute| Metrics --> Artifacts
```

## Data Flow: Morning Reading

The core use case — taking a morning HRV reading — follows this sequence:

```mermaid
sequenceDiagram
    actor User
    participant Home as HomeScreen
    participant Reading as ReadingScreen
    participant BLE as useBleRecording
    participant Polar as Polar H10
    participant HRV as HRV Engine
    participant DB as SQLite

    User->>Home: Tap "Start Reading"
    Home->>Reading: Navigate (modal)

    Note over Reading: Phase 1: Scanning
    Reading->>BLE: Request permissions
    BLE->>BLE: requestBlePermissions()
    Reading->>BLE: scanForDevices()
    BLE->>Polar: BLE scan (HR Service 0x180D)
    Polar-->>BLE: Device discovered
    BLE-->>Reading: onDeviceFound(device)

    Note over Reading: Phase 2: Recording (5 min)
    User->>Reading: Select device
    Reading->>BLE: startRecording(deviceId)
    BLE->>Polar: connectAndSubscribe()
    Polar-->>BLE: HR Measurement notifications (0x2A37)
    BLE->>BLE: parseHeartRateMeasurement()

    loop Every notification
        BLE-->>Reading: onHeartRateMeasurement(hr, rr[])
        Reading->>Reading: Accumulate RR intervals
    end

    Note over Reading: Phase 3: Processing
    alt 5 min elapsed OR user taps Finish Early (≥2 min)
        BLE->>BLE: stopRecording()
    end

    Reading->>HRV: computeHrvMetrics(rrIntervals)
    HRV->>HRV: filterArtifacts() → detectArtifacts()
    HRV->>HRV: computeRmssd(), computeSdnn()
    HRV->>HRV: computeMeanHr(), computePnn50()
    HRV-->>Reading: HrvMetrics

    Reading->>DB: getDailyReadings(windowDays)
    DB-->>Reading: DailyReading[]
    Reading->>HRV: computeBaseline(readings)
    HRV-->>Reading: BaselineResult
    Reading->>HRV: computeVerdict(rmssd, baseline)
    HRV-->>Reading: VerdictType | null

    Reading->>DB: saveSession(session)
    Reading->>User: Navigate to LogScreen

    Note over User: Optional subjective log
    User->>DB: updateSessionLog(readiness, type, notes)
    User->>Home: Navigate back
```

## HRV Computation Pipeline

```mermaid
flowchart LR
    Raw[Raw RR Intervals<br/>from BLE] --> Detect[Detect Artifacts<br/>5-beat moving median]
    Detect --> Filter[Filter Artifacts<br/>remove flagged intervals]
    Filter --> Clean[Clean RR Intervals]

    Clean --> RMSSD[rMSSD<br/>√mean of squared<br/>successive diffs]
    Clean --> SDNN[SDNN<br/>population std dev<br/>÷N not ÷N-1]
    Clean --> HR[Mean HR<br/>60000 ÷ mean RR]
    Clean --> PNN50[pNN50<br/>% of diffs > 50ms]

    RMSSD --> Baseline{Baseline<br/>≥5 days?}
    Baseline -->|Yes| Compare[Compare to<br/>median rMSSD]
    Baseline -->|No| NoVerdict[null<br/>Building Baseline]

    Compare --> Ratio{ratio = current ÷ baseline}
    Ratio -->|≥ 0.95| GoHard[🟢 Go Hard]
    Ratio -->|≥ 0.80| Moderate[🟡 Moderate]
    Ratio -->|< 0.80| Rest[🔴 Rest]
```

## Artifact Detection Algorithm

The artifact detector uses a local 5-beat moving median to identify physiologically implausible RR intervals:

```mermaid
flowchart TD
    Input[RR Intervals Array] --> Check{Length ≥ 5?}
    Check -->|No| AllClean[Return all false<br/>no artifacts]
    Check -->|Yes| Loop[For each RR interval i]

    Loop --> Window[Extract window<br/>±2 beats around i]
    Window --> Median[Compute local<br/>median of window]
    Median --> Dev{deviation =<br/>|RR_i - median| ÷ median}
    Dev -->|> 0.20| Artifact[Flag as artifact ✗]
    Dev -->|≤ 0.20| Clean[Mark as clean ✓]
    Artifact --> Next
    Clean --> Next[Next interval]
```

## Database Schema

```mermaid
erDiagram
    sessions {
        TEXT id PK "UUID v4"
        TEXT timestamp "ISO 8601 UTC"
        INTEGER duration_seconds "Recording length"
        TEXT rr_intervals "JSON array of ms values"
        REAL rmssd "Root mean square successive diff"
        REAL sdnn "Std dev of NN intervals"
        REAL mean_hr "Average heart rate bpm"
        REAL pnn50 "% successive diffs > 50ms"
        REAL artifact_rate "Fraction flagged"
        TEXT verdict "go_hard | moderate | rest | null"
        INTEGER perceived_readiness "1-5 subjective"
        TEXT training_type "Strength | BJJ | Cycling | Rest | Other"
        TEXT notes "Free-text"
        TEXT created_at "datetime('now')"
    }

    settings {
        TEXT key PK "Setting name"
        TEXT value "Setting value (string)"
    }
```

**Key settings keys:**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `baselineWindowDays` | int | `7` | Rolling baseline window (5, 7, 10, 14) |
| `goHardThreshold` | float | `0.95` | Ratio for Go Hard verdict |
| `moderateThreshold` | float | `0.80` | Ratio for Moderate verdict |
| `pairedDeviceId` | string | `null` | Remembered BLE device ID |
| `pairedDeviceName` | string | `null` | Remembered BLE device name |
| `onboarding_complete` | string | — | `"true"` after onboarding |

## Navigation Structure

```mermaid
graph TD
    App[App.tsx] --> Init{Initialized?}
    Init -->|Loading| Spinner[ActivityIndicator]
    Init -->|Error| ErrorView[Error Display]
    Init -->|First Launch| Onboarding[OnboardingScreen]
    Init -->|Ready| Navigator[AppNavigator]

    Navigator --> Tabs[Bottom Tab Navigator]
    Tabs --> HomeTab[🏠 Home]
    Tabs --> HistoryTab[📊 History]
    Tabs --> SettingsTab[⚙️ Settings]

    Navigator --> Stack[Modal Stack]
    Stack --> ReadingModal[📱 Reading]
    Stack --> LogModal[📝 Log]
    Stack --> DetailModal[🔍 Session Detail]
    Stack --> PrivacyModal[🔒 Privacy Policy]

    HomeTab -->|Start Reading| ReadingModal
    ReadingModal -->|Recording complete| LogModal
    HistoryTab -->|Tap session| DetailModal
    SettingsTab -->|Privacy link| PrivacyModal
```

## Module Dependency Graph

```mermaid
graph LR
    subgraph Types["types/"]
        T[index.ts]
    end

    subgraph Constants["constants/"]
        Colors[colors.ts]
        Defaults[defaults.ts]
        Verdicts[verdicts.ts]
    end

    subgraph HRV["hrv/"]
        Metrics[metrics.ts]
        Artifacts[artifacts.ts]
        Baseline[baseline.ts]
        Verdict[verdict.ts]
    end

    subgraph BLE_["ble/"]
        BleM[bleManager.ts]
        Parser[heartRateParser.ts]
        Perms[permissions.ts]
        Hook[useBleRecording.ts]
    end

    subgraph Database_["database/"]
        DB[database.ts]
        SRepo[sessionRepository.ts]
        StRepo[settingsRepository.ts]
    end

    subgraph Utils["utils/"]
        Date[date.ts]
        UUID[uuid.ts]
        CSV[csv.ts]
        Crash[crashReporting.ts]
    end

    Metrics --> Artifacts
    Metrics --> T
    Artifacts --> Defaults
    Baseline --> T
    Verdict --> T & Defaults
    Verdicts --> T

    BleM --> Parser
    Hook --> BleM & Defaults

    SRepo --> DB & T & Date
    StRepo --> DB & T

    CSV --> T
```

## Key Design Decisions

### Why Median (not Mean) for Baseline?

The 7-day rMSSD baseline uses the **median** rather than the arithmetic mean. A single outlier session (e.g., a recording taken during a panic attack or with poor sensor contact) would skew a mean-based baseline, but median is resistant to this. This is standard practice in HRV research for rolling baselines.

### Why Population Std Dev (÷N) for SDNN?

SDNN uses `÷ N` (population std dev) rather than `÷ (N-1)` (sample std dev). In HRV analysis, the RR intervals represent the complete set of heartbeats recorded during the session — not a sample from a larger population. The population standard deviation is therefore the correct formula.

### Why 5-Minute Recording Duration?

The European Society of Cardiology recommends a minimum 5-minute recording for short-term HRV analysis. The 2-minute early-finish option is provided as a compromise — enough data for a reasonable estimate while accommodating user impatience, but a warning is shown if artifact rate exceeds 5%.

### Why Heart Rate Service Only (No PMD/Raw ECG)?

The Polar H10 supports both the standard Heart Rate Service (0x180D) and a proprietary PMD (Polar Measurement Data) service for raw ECG. V1 uses only the standard service because:
- It works with **any** BLE heart rate monitor, not just Polar
- RR intervals from the HR service are sufficient for time-domain HRV metrics
- No custom SDK dependency required
- Simpler permission model

### Why Local-Only Storage?

All data stays on-device in SQLite. This eliminates:
- Privacy concerns around health data
- Need for user accounts or authentication
- Server infrastructure and costs
- Network dependency for a morning-routine app

Export is available via CSV for users who want to analyze data externally.
