---
sidebar_position: 2
---

# Data Flow

This document traces the complete flow of data through the application during a morning HRV reading session.

## Morning Reading Sequence

```mermaid
sequenceDiagram
    actor User
    participant HomeScreen
    participant ReadingScreen
    participant useBleRecording Hook
    participant BLE Manager
    participant Polar H10
    participant HRV Engine
    participant Artifact Detection
    participant SessionRepository
    participant SQLite
    participant LogScreen

    User->>HomeScreen: Opens app / Home tab
    HomeScreen->>SessionRepository: Query latest sessions (for baseline)
    SessionRepository->>SQLite: SELECT * FROM sessions ORDER BY timestamp DESC LIMIT 30
    SQLite-->>SessionRepository: Sessions data
    SessionRepository-->>HomeScreen: Parsed session list
    HomeScreen->>HomeScreen: Calculate baseline metrics

    User->>HomeScreen: Taps "Start Recording"
    HomeScreen->>ReadingScreen: Navigate to recording UI

    activate ReadingScreen
    ReadingScreen->>useBleRecording Hook: Initialize hook (startRecording)
    activate useBleRecording Hook
    useBleRecording Hook->>BLE Manager: requestPermissions()
    BLE Manager-->>useBleRecording Hook: Permissions granted

    useBleRecording Hook->>BLE Manager: scanForPeripherals()
    BLE Manager->>Polar H10: BLE scan request
    Polar H10-->>BLE Manager: Advertisement received
    BLE Manager-->>useBleRecording Hook: Device discovered

    User->>ReadingScreen: Taps device in list
    ReadingScreen->>useBleRecording Hook: connectToDevice(polarH10)
    useBleRecording Hook->>BLE Manager: connect(polarH10)
    BLE Manager->>Polar H10: BLE connect (GATT handshake)
    Polar H10-->>BLE Manager: Connected
    BLE Manager-->>useBleRecording Hook: Connected ✓

    activate Polar H10
    useBleRecording Hook->>Polar H10: Subscribe to Heart Rate Service
    Polar H10-->>useBleRecording Hook: RR interval 1
    ReadingScreen->>ReadingScreen: Display "Recording in progress..."

    loop Every RR interval received
        Polar H10-->>useBleRecording Hook: RR interval (ms)
        useBleRecording Hook->>Artifact Detection: checkArtifact(rrValue)
        Artifact Detection->>Artifact Detection: Compare to 5-beat moving median
        alt Artifact detected
            Artifact Detection-->>useBleRecording Hook: artifact flag (skip)
        else Valid RR interval
            Artifact Detection-->>useBleRecording Hook: valid RR interval
            useBleRecording Hook->>useBleRecording Hook: Add to RR array
            ReadingScreen->>ReadingScreen: Update live display
        end
    end

    deactivate Polar H10

    User->>ReadingScreen: Taps "Stop Recording" (after ~5 min)
    ReadingScreen->>useBleRecording Hook: stopRecording()
    useBleRecording Hook->>BLE Manager: disconnect()
    BLE Manager->>Polar H10: BLE disconnect
    Polar H10-->>BLE Manager: Disconnected
    deactivate useBleRecording Hook

    ReadingScreen->>HRV Engine: calculateMetrics(rrIntervals, artifactFlags)
    HRV Engine->>HRV Engine: RMSSD = sqrt(mean(diff(RR)²))
    HRV Engine->>HRV Engine: SDNN = stdev(RR) using population formula
    HRV Engine->>HRV Engine: mean_hr = 60000 / mean(RR)
    HRV Engine->>HRV Engine: pNN50 = % of RR intervals > 50ms different
    HRV Engine-->>ReadingScreen: Metrics object (RMSSD, SDNN, mean_hr, pNN50, artifact_rate)

    ReadingScreen->>SessionRepository: saveSession(metrics, rrIntervals)
    SessionRepository->>SQLiteDB: INSERT INTO sessions (timestamp, rr_intervals, rmssd, sdnn, mean_hr, pnn50, artifact_rate, ...)
    SQLite-->>SessionRepository: Row saved

    ReadingScreen->>ReadingScreen: Calculate readiness verdict (Readiness Logic)
    ReadingScreen->>ReadingScreen: Display metrics & verdict

    deactivate ReadingScreen

    User->>LogScreen: Navigates to Log tab
    LogScreen->>SessionRepository: getSessionsSorted(orderBy, limit)
    SessionRepository->>SQLite: SELECT * FROM sessions ORDER BY timestamp DESC
    SQLite-->>SessionRepository: All sessions
    SessionRepository-->>LogScreen: Session list with parsed metrics
    LogScreen->>LogScreen: Render history table
```

## Phase Details

### 1. **Initialization & Baseline**
- App loads home screen
- Repository queries last 30 sessions from SQLite
- Readiness Logic calculates baseline metrics (median RMSSD, etc.)

### 2. **Scan Phase**
- BLE hook requests Bluetooth permissions
- BLE Manager initiates peripheral scan
- Polar H10 advertisement is detected
- User selects device from list

### 3. **Connect Phase**
- BLE Manager establishes GATT connection
- Heart Rate Service is discovered and subscribed to
- RR intervals begin streaming

### 4. **Record Phase**
- Polar H10 sends RR intervals (every beat)
- Artifact Detection filters physiologically implausible values
- Valid RR intervals accumulate in state
- UI shows live HR and interval count

### 5. **Process Phase**
- User stops recording after ~5 minutes
- HRV Engine calculates metrics from validated RR array:
  - **RMSSD**: Root mean square of successive differences
  - **SDNN**: Standard deviation (population formula, not sample)
  - **mean_hr**: Average heart rate
  - **pNN50**: Percentage of intervals with > 50ms difference
  - **artifact_rate**: % of RR intervals removed

### 6. **Save Phase**
- Session object (timestamp, metrics, RR array as JSON, notes) inserted into SQLite
- Repository returns success

### 7. **Log Phase**
- LogScreen queries all sessions from database
- Displays sortable/filterable history table
- Each row shows date, time, verdict, and key metrics

---

## Critical Data Transformations

| Stage | Input | Processing | Output |
|-------|-------|-----------|--------|
| **BLE→Artifact** | RR intervals (ms) | 5-beat moving median filter | Valid RR intervals + flags |
| **RR→HRV** | Valid RR array | RMSSD, SDNN formulas | Numeric metrics |
| **Metrics→Readiness** | Current metrics + baseline | Compare to thresholds | Verdict (Go Hard / Moderate / Rest) |
| **Session→Storage** | Metrics object + RR array | JSON serialize | SQLite INSERT |
| **Storage→Display** | SQLite rows | JSON parse + format | Rendered UI table |

---

## Error Handling & Fallbacks

- **BLE connection fails**: User can retry scan
- **Recording interrupted**: UI prompts to discard or save partial data
- **High artifact rate (>40%)**: Warning displayed; user advised to re-wet electrodes or adjust sensor contact
- **Baseline insufficient**: "Building Baseline" message; normal readings still recorded

