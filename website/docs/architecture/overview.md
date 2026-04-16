---
sidebar_position: 1
---

# Architecture Overview

The HRV Morning Readiness Dashboard follows a **layered architecture** that separates concerns between presentation, domain logic, data access, and hardware communication. This design enables testability, maintainability, and clear dependencies.

## Architectural Layers

```mermaid
graph TB
    subgraph Presentation["📱 Presentation Layer"]
        HomeScreen["HomeScreen<br/>(stats, verdicts)"]
        ReadingScreen["ReadingScreen<br/>(live recording)"]
        LogScreen["LogScreen<br/>(history)"]
        SettingsScreen["SettingsScreen<br/>(config)"]
    end

    subgraph Domain["🧠 Domain Layer"]
        HRVEngine["HRV Engine<br/>(RMSSD, SDNN,<br/>mean_hr, pnn50)"]
        ReadinessLogic["Readiness Logic<br/>(baseline, thresholds,<br/>verdicts)"]
        ArtifactDetection["Artifact Detection<br/>(noise filtering)"]
    end

    subgraph Data["💾 Data Layer"]
        SessionRepo["SessionRepository<br/>(CRUD, queries)"]
        SettingsRepo["SettingsRepository<br/>(key-value pairs)"]
        SQLiteDB["SQLite Database<br/>(sessions, settings)"]
    end

    subgraph BLE["🔗 BLE/External Layer"]
        BLEHook["useBleRecording Hook<br/>(scan, connect, record)"]
        BLEManager["BLE Manager<br/>(lifecycle,<br/>permissions)"]
        PolarH10["Polar H10<br/>(RR intervals)"]
    end

    HomeScreen --> HRVEngine
    HomeScreen --> ReadinessLogic
    ReadingScreen --> BLEHook
    ReadingScreen --> HRVEngine
    LogScreen --> SessionRepo
    SettingsScreen --> SettingsRepo
    ReadinessLogic --> SessionRepo
    BLEHook --> BLEManager
    BLEHook --> ArtifactDetection
    HRVEngine --> Domain
    BLEManager --> PolarH10
    SessionRepo --> SQLiteDB
    SettingsRepo --> SQLiteDB

    style Presentation fill:#e1f5ff
    style Domain fill:#f3e5f5
    style Data fill:#fff3e0
    style BLE fill:#e8f5e9
```

## Layer Descriptions

### 📱 Presentation Layer
**Screens and UI components** that display data and handle user interactions.

- **HomeScreen**: Displays today's HRV metrics and readiness verdict; allows starting a new recording
- **ReadingScreen**: Shows live RR intervals during recording; handles BLE connection feedback
- **LogScreen**: Lists past sessions with sortable/filterable history
- **SettingsScreen**: Configure device pairing, threshold adjustments, and other preferences

Dependencies: Domain logic, repositories, BLE hooks

---

### 🧠 Domain Layer
**Pure business logic** that operates on data without side effects. Highly testable.

- **HRV Engine**: Calculates RMSSD, SDNN, mean HR, pNN50 from RR intervals
- **Readiness Logic**: Compares current metrics against baseline; assigns verdict (Go Hard / Moderate / Rest)
- **Artifact Detection**: Identifies and filters physiologically implausible RR intervals (> 5-beat median)

Dependencies: None (pure functions)

---

### 💾 Data Layer
**Repository pattern** for database access and persistence.

- **SessionRepository**: Save, retrieve, update sessions; query by date range, export to CSV
- **SettingsRepository**: Get/set key-value configuration (baseline window, thresholds, device ID, etc.)
- **SQLite Database**: Local-only storage; no network, no cloud sync

Dependencies: Data access driver

---

### 🔗 BLE/External Layer
**Hardware communication** and sensor integration.

- **useBleRecording Hook**: React hook for scan, connect, record lifecycle; manages BLE state
- **BLE Manager**: Handles Android/iOS permissions, device lifecycle, connection stability
- **Polar H10**: Bluetooth LE Heart Rate Service; streams RR intervals as received values

Dependencies: Native modules (react-native-ble-plx), OS permissions

---

## Data Flow at a Glance

1. **User opens app** → HomeScreen loads baseline from database
2. **User taps "Record"** → ReadingScreen activates BLE hook
3. **BLE scans & connects** to Polar H10 → RR intervals stream in
4. **HRV Engine processes** RR intervals → calculates metrics
5. **Recording ends** → SessionRepository saves to SQLite
6. **HomeScreen displays** new verdict from Readiness Logic

See [Data Flow](./data-flow.md) for detailed sequence diagrams.

---

## Key Design Principles

- **Separation of Concerns**: Each layer has a single responsibility
- **Testability**: Domain logic is pure; easily unit tested
- **Modularity**: Components/hooks are composable and reusable
- **Local-First**: All data stays on device; no network dependency
- **Type Safety**: Full TypeScript strict mode across codebase

