---
sidebar_position: 1
---

# Architecture Overview

The HRV Morning Readiness Dashboard follows a **layered architecture** that separates concerns between presentation, domain logic, data access, hardware communication, and optional cloud services. This design enables testability, maintainability, and clear dependencies.

## Architectural Layers

```mermaid
graph TB
    subgraph Presentation["📱 Presentation Layer (18 screens)"]
        HomeScreen["HomeScreen<br/>(verdict, sparkline, recovery)"]
        ReadingScreen["ReadingScreen<br/>(BLE scan → record)"]
        MorningProtocol["MorningProtocolScreen<br/>(breathing → record → log)"]
        HistoryScreen["HistoryScreen<br/>(session list, trends)"]
        TrendsScreen["TrendsScreen<br/>(analytics, correlations)"]
        SettingsScreen["SettingsScreen<br/>(config, export, backup)"]
        OtherScreens["+ 12 more screens"]
    end

    subgraph Domain["🧠 Domain Layer (17 modules)"]
        HRVEngine["HRV Engine<br/>(rMSSD, SDNN, pNN50)"]
        Spectral["Spectral Analysis<br/>(LF/HF/VLF bands)"]
        ArtifactDetection["Artifact Detection<br/>(5-beat median filter)"]
        Baseline["Baseline<br/>(rolling median)"]
        Verdict["Verdict Logic<br/>(fixed + adaptive)"]
        Recovery["Recovery Score<br/>(composite 0–100)"]
        TSB["Training Stress<br/>(ATL/CTL/TSB)"]
        Coach["Coach Narrative<br/>(daily briefs)"]
        Prediction["Prediction<br/>(next-day rMSSD)"]
        Norms["Population Norms<br/>(age/sex percentiles)"]
        Coherence["Coherence Trainer<br/>(Goertzel biofeedback)"]
    end

    subgraph Data["💾 Data Layer"]
        SessionRepo["SessionRepository<br/>(CRUD, queries)"]
        SettingsRepo["SettingsRepository<br/>(key-value pairs)"]
        SQLiteDB["SQLite Database<br/>(WAL mode)"]
    end

    subgraph BLE["🔗 BLE Layer"]
        BLEManager["BLE Manager<br/>(scan, connect, retry)"]
        HRParser["Heart Rate Parser<br/>(GATT 0x2A37)"]
        PPG["PPG Processor<br/>(camera fallback)"]
        DeviceProfiles["Device Profiles<br/>(per-device tolerance)"]
    end

    subgraph Integrations["🔌 Integrations"]
        HealthSync["HealthKit /<br/>Health Connect"]
        ImportWizard["CSV Import<br/>(Whoop/Oura/Garmin)"]
        WorkoutExport["Workout Export<br/>(Strava/TP/Intervals)"]
    end

    subgraph Security["🔐 Security Layer"]
        Sync["E2E Encrypted Sync<br/>(AES-256-GCM + scrypt)"]
        Backup["Encrypted Backup<br/>(.hrvbak files)"]
        Share["Coach Share<br/>(pairing codes)"]
        Plugins["Plugin Sandbox<br/>(5 reference plugins)"]
    end

    Presentation --> Domain
    Presentation --> Data
    Presentation --> BLE
    Domain --> Data
    BLE --> Domain
    Integrations --> Data
    Security --> Data

    style Presentation fill:#e1f5ff
    style Domain fill:#f3e5f5
    style Data fill:#fff3e0
    style BLE fill:#e8f5e9
    style Integrations fill:#e8eaf6
    style Security fill:#fce4ec
```

## Layer Descriptions

### 📱 Presentation Layer (18 screens)
React Native screens and reusable UI components. Key screens: HomeScreen (today's verdict), ReadingScreen (BLE recording), MorningProtocolScreen (guided 3-phase flow), HistoryScreen (session list), TrendsScreen (weekly analytics), SettingsScreen (configuration), plus CoherenceScreen, OrthostaticScreen, ImportScreen, PluginsScreen, ProfilesScreen, and more.

### 🧠 Domain Layer (17 modules)
Pure business logic with no side effects — highly testable. Covers: HRV metrics, spectral analysis, artifact detection, baseline computation, verdict logic (fixed + adaptive), recovery scoring, training stress (ATL/CTL/TSB), coach narrative, prediction, population norms, ANS balance, sleep architecture, circadian analysis, and coherence biofeedback.

### 💾 Data Layer
Repository pattern for SQLite access. SessionRepository handles session CRUD and queries. SettingsRepository provides key-value configuration storage. Database initialization includes migration management and WAL mode.

### 🔗 BLE Layer
Hardware communication via react-native-ble-plx. Supports any BLE heart rate monitor via standard Heart Rate Service (0x180D). Includes camera PPG processor as a no-strap fallback and device profiles for per-device artifact tolerance tuning.

### 🔌 Integrations
Two-way HealthKit/Health Connect sync, CSV import wizard (Whoop/Oura/Garmin/EliteHRV/HRV4Training), and workout export to Strava, TrainingPeaks, and Intervals.icu.

### 🔐 Security Layer
End-to-end encrypted cloud sync (AES-256-GCM with scrypt KDF), encrypted backup/restore, coach share bundles with CSPRNG pairing codes, and sandboxed plugin execution with static source auditing.

---

## Key Design Principles

- **Separation of Concerns**: Each layer has a single responsibility
- **Testability**: Domain logic is pure functions; 1,000+ unit tests
- **Local-First**: All data on device by default; cloud is opt-in and encrypted
- **Type Safety**: Full TypeScript strict mode across the codebase
- **Privacy by Default**: No telemetry, no analytics, no network calls unless user opts in
- **Extensibility**: Plugin system for custom metrics, open import parsers for new vendors

