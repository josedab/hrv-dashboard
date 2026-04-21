# HRV Morning Readiness Dashboard

[![CI](https://github.com/josedab/hrv-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/josedab/hrv-dashboard/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Expo](https://img.shields.io/badge/Expo-52-000020?logo=expo)](https://expo.dev/)
[![Tests](https://img.shields.io/badge/tests-1042%20passing-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-85%25-brightgreen)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A React Native (Expo) mobile app that connects to a Polar H10 chest strap via Bluetooth, records RR intervals each morning, computes HRV metrics, and delivers a single, actionable readiness verdict for the day. All data stays on-device — no cloud, no accounts.

## Readiness Verdicts

| Verdict | Threshold | Meaning |
|---------|-----------|---------|
| 🟢 **Go Hard** | rMSSD ≥ 95% of baseline | Full intensity training appropriate |
| 🟡 **Moderate** | rMSSD 80–95% of baseline | Train, but avoid max effort |
| 🔴 **Rest or Easy** | rMSSD < 80% of baseline | Prioritize recovery |

Baseline is computed as the **median rMSSD** over a rolling 7-day window (configurable: 5, 7, 10, or 14 days). A minimum of 5 days of readings is required before verdicts are generated.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | React Native (Expo bare workflow) | iOS & Android from one codebase |
| Storage | expo-sqlite (WAL mode) | Local-only persistence, no backend |
| Bluetooth | react-native-ble-plx | Heart Rate Service (0x180D) via BLE |
| Charts | react-native-svg | Sparklines, RR plots, countdown timer |
| Navigation | React Navigation 7 | Bottom tabs + modal stack |
| Language | TypeScript (strict mode) | Type safety throughout |

## Getting Started

### Prerequisites

- Node.js 18+
- iOS: Xcode 15+ / Android: Android Studio with SDK 33+
- A physical device (BLE does not work in simulators)
- A Polar H10 or any HR monitor advertising Heart Rate Service

### Installation

```bash
# Install dependencies
npm install

# Copy environment template (optional — only needed for Sentry)
cp .env.example .env

# Generate native projects (first time only)
npx expo prebuild

# Start Expo dev server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run tests
npm test

# Lint, typecheck, format
npm run lint
npm run typecheck
npm run format
```

### Physical Device Setup

BLE does not work in simulators — a physical device is required.

**iOS:**
1. Install CocoaPods: `sudo gem install cocoapods`
2. Run `npx expo prebuild` to generate the `ios/` directory
3. Run `cd ios && pod install && cd ..`
4. Open `ios/*.xcworkspace` in Xcode, configure your signing team
5. Connect your iPhone and run `npm run ios`

**Android:**
1. Enable Developer Options → USB Debugging on your device
2. Run `npx expo prebuild` to generate the `android/` directory
3. Connect your device via USB and run `npm run android`

> **Note:** This app uses `expo-dev-client` for native module support. The standard Expo Go app will not work.

### BLE Permissions

| Platform | Permissions | How |
|----------|------------|-----|
| iOS | Bluetooth | System dialog via `NSBluetoothAlwaysUsageDescription` in Info.plist |
| Android 12+ | `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` | Requested at runtime |
| Android 10–11 | `ACCESS_FINE_LOCATION` | Requested with rationale dialog |

## Project Structure

```
src/
├── biofeedback/      # Real-time HRV biofeedback
│   └── coherence.ts        # Coherence trainer (Goertzel frequency analysis)
├── ble/              # BLE scanning, connection, HR parsing, permissions
│   ├── bleManager.ts       # Device scanning & connection lifecycle
│   ├── deviceProfiles.ts   # Per-device HRM profiles & artifact tolerance
│   ├── heartRateParser.ts  # GATT Heart Rate Measurement (0x2A37) parser
│   ├── permissions.ts      # Cross-platform BLE permission handling
│   ├── ppgProcessor.ts     # Camera-based PPG signal processing (no-strap fallback)
│   └── useBleRecording.ts  # React hook for recording state management
├── components/       # Reusable UI components
│   ├── BreathingExercise.tsx # Guided pre-recording breathing exercise
│   ├── ConnectionPill.tsx   # BLE connection status indicator
│   ├── CountdownTimer.tsx   # Circular SVG countdown
│   ├── ErrorBoundary.tsx    # Error boundary with recovery UI
│   ├── PassphraseModal.tsx  # Encryption passphrase entry modal
│   ├── ReadinessSlider.tsx  # 1–5 perceived readiness selector
│   ├── RRPlot.tsx           # RR interval line chart
│   ├── Sparkline.tsx        # Compact trend line with optional baseline
│   ├── StatCard.tsx         # Metric display card
│   ├── Toast.tsx            # Toast notification component
│   ├── VerdictDisplay.tsx   # Verdict emoji, label, and description
│   └── WorkoutCard.tsx      # Workout-of-the-day prescription card
├── constants/        # App-wide constants
│   ├── colors.ts            # Dark theme palette & verdict colors
│   ├── defaults.ts          # Recording durations, thresholds, training types
│   ├── strings.ts           # Centralized UI strings (i18n-ready)
│   └── verdicts.ts          # Verdict display info (labels, emojis)
├── database/         # SQLite persistence
│   ├── database.ts          # DB initialization, migrations, singleton
│   ├── sessionRepository.ts # Session CRUD & queries
│   └── settingsRepository.ts# Key-value settings storage
├── hooks/            # Custom React hooks
│   ├── useMorningProtocol.ts # Guided morning protocol phase sequencer
│   ├── useReadingFlow.ts    # Recording flow state management
│   └── useSessionPersistence.ts # Session save/load lifecycle
├── hrv/              # Core HRV computation engine
│   ├── adaptiveThresholds.ts # Personal percentile-based verdict cutoffs
│   ├── analytics.ts         # Weekly summaries, trends, correlations
│   ├── ansBalance.ts        # Autonomic nervous system balance (LF/HF zones)
│   ├── artifacts.ts         # Artifact detection (5-beat moving median)
│   ├── baseline.ts          # Rolling median rMSSD baseline
│   ├── baselineAccelerator.ts # Pre-compute baseline from imported data
│   ├── circadian.ts         # Recording time consistency & optimal window
│   ├── coachNarrative.ts    # Template-based AI recovery coach briefs
│   ├── metrics.ts           # rMSSD, SDNN, mean HR, pNN50
│   ├── norms.ts             # Age/sex-stratified HRV population percentiles
│   ├── orthostatic.ts       # Orthostatic test (supine vs. standing)
│   ├── prediction.ts        # Next-day rMSSD & verdict prediction
│   ├── recovery.ts          # Composite recovery score & training load
│   ├── sleepArchitecture.ts # Hypnogram builder & sleep-HRV correlation
│   ├── spectral.ts          # Frequency-domain analysis (VLF/LF/HF bands)
│   ├── trainingStress.ts    # Training Stress Balance (ATL/CTL/TSB model)
│   └── verdict.ts           # Threshold-based readiness verdict (fixed + adaptive)
├── integrations/     # Health platform integrations
│   ├── healthAutoPull.ts    # Auto-pull sleep data from HealthKit/Health Connect
│   ├── healthSleep.ts       # Read last-night sleep stages
│   ├── healthTwoWay.ts      # Two-way HealthKit/Health Connect sync controller
│   ├── sleepStrain.ts       # Sleep-strain fusion for enhanced recovery
│   └── import/              # Third-party data import
│       ├── vendors.ts       # Whoop/Oura/Garmin CSV/JSON parsers
│       └── wizard.ts        # Import wizard pipeline (parse → plan → commit)
├── navigation/       # React Navigation configuration
│   └── AppNavigator.tsx     # Bottom tabs (4) + modal stack (10+ screens)
├── plugins/          # Custom metric plugin system
│   ├── host.ts              # Sandboxed plugin execution engine
│   ├── marketplace.ts       # Plugin catalog & install management
│   ├── protocol.ts          # Open HRV Protocol interchange format
│   ├── sqliteStorage.ts     # SQLite-backed plugin persistence
│   └── reference/           # Built-in reference plugins
│       └── index.ts         # Poincaré, FFT LF/HF, DFA-α1, Recovery Velocity, Weekly Z-Score
├── screens/          # App screens (18 total)
│   ├── CameraReadingScreen.tsx  # Camera PPG reading (no-strap fallback)
│   ├── CoherenceScreen.tsx      # Biofeedback coherence trainer
│   ├── HistoryScreen.tsx        # Session list with sparkline header
│   ├── HomeScreen.tsx           # Today's verdict, sparkline, recovery score
│   ├── ImportScreen.tsx         # CSV import wizard (Whoop/Oura/Garmin)
│   ├── LogScreen.tsx            # Post-recording subjective log
│   ├── MorningProtocolScreen.tsx# Guided 3-phase morning recording flow
│   ├── OnboardingScreen.tsx     # First-launch carousel
│   ├── OrthostaticScreen.tsx    # Orthostatic HRV test workflow
│   ├── PluginsScreen.tsx        # Plugin management & marketplace
│   ├── PrivacyPolicyScreen.tsx  # Local-only privacy policy
│   ├── ProfilesScreen.tsx       # Multi-athlete profile switching
│   ├── ReadingScreen.tsx        # BLE scan → record → complete workflow
│   ├── SessionDetailScreen.tsx  # Full session metrics view
│   ├── SettingsScreen.tsx       # Baseline, thresholds, export, backup, sync
│   ├── ShareCoachScreen.tsx     # Encrypted coach share bundles
│   ├── SyncSettingsScreen.tsx   # Cloud sync configuration
│   └── TrendsScreen.tsx         # Weekly analytics, correlations, trends
├── share/            # Coach share bundles
│   └── index.ts             # Seal/unseal encrypted share bundles with pairing codes
├── sync/             # End-to-end encrypted cloud sync
│   ├── aesGcm.ts            # AES-256-GCM cipher wrapper
│   ├── cloudProviders.ts    # Supabase sync provider
│   ├── crypto.ts            # Encryption/decryption pipeline (protocol v4)
│   ├── inMemoryProvider.ts  # In-memory sync provider for testing
│   ├── index.ts             # Sync orchestration & conflict resolution
│   └── scryptKdf.ts         # Memory-hard scrypt key derivation
├── types/            # TypeScript type definitions
│   └── index.ts             # Session, HrvMetrics, Settings, VerdictMode, etc.
├── utils/            # Utility functions
│   ├── backup.ts            # Encrypted backup/restore (.hrvbak files)
│   ├── crashReporting.ts    # Sentry integration with console fallback
│   ├── csv.ts               # Session-to-CSV export
│   ├── date.ts              # Date formatting & streak calculation
│   ├── encoding.ts          # Binary encoding utilities
│   ├── healthSync.ts        # Apple HealthKit / Android Health Connect sync
│   ├── notifications.ts     # Morning reminder, streak protection, weekly digest
│   ├── profiles.ts          # Multi-athlete profiles & verdict sharing
│   ├── reportGenerator.ts   # HTML/PDF report generation
│   ├── shareCard.ts         # Branded shareable verdict cards
│   ├── uuid.ts              # UUID v4 generator
│   └── widgetData.ts        # iOS WidgetKit / Android Glance widget data
└── workout/          # Workout generation & export
    ├── exporters.ts         # Strava/TrainingPeaks/Intervals.icu push adapters
    └── generator.ts         # Verdict → structured workout prescription

examples/                    # Standalone TypeScript examples (runnable without React Native)
apps/coach-web/              # Next.js web app for coaches to monitor athlete data
watch-app/                   # Apple Watch + Wear OS companion app skeletons
web-demo/                    # Static single-file web demo (no hardware needed)
```

## Core Algorithm

```
Raw RR Intervals (from BLE)
    │
    ▼
┌─────────────────────────┐
│  Artifact Detection     │  Flag intervals deviating >20%
│  (5-beat moving median) │  from local median
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Filter Artifacts       │  Remove flagged intervals,
│                         │  compute artifact rate
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Compute Metrics        │  rMSSD, SDNN (pop. σ),
│                         │  mean HR, pNN50 (%)
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Baseline Comparison    │  Current rMSSD vs.
│  (median of 7-day rMSSD)│  rolling median baseline
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Verdict                │  ≥95% → Go Hard
│                         │  ≥80% → Moderate
│                         │  <80% → Rest
└─────────────────────────┘
```

## Data Model

All data is stored locally in SQLite. Optional end-to-end encrypted cloud sync is available (see [Crypto docs](docs/CRYPTO.md)), but no user accounts are required for core functionality.

### Sessions Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | UUID v4 |
| `timestamp` | TEXT | ISO 8601 UTC |
| `duration_seconds` | INTEGER | Recording length |
| `rr_intervals` | TEXT | JSON array of RR intervals (ms) |
| `rmssd` | REAL | Root mean square of successive differences |
| `sdnn` | REAL | Standard deviation of NN intervals (population) |
| `mean_hr` | REAL | Average heart rate (bpm) |
| `pnn50` | REAL | % of successive diffs > 50ms |
| `artifact_rate` | REAL | Fraction of RR intervals flagged (0–1) |
| `verdict` | TEXT | `go_hard`, `moderate`, `rest`, or `null` |
| `perceived_readiness` | INTEGER | Subjective readiness 1–5 (optional) |
| `training_type` | TEXT | Strength, BJJ, Cycling, Rest, Other (optional) |
| `notes` | TEXT | Free-text notes (optional) |
| `sleep_hours` | REAL | Hours of sleep the night before (optional, 0–24) |
| `sleep_quality` | INTEGER | Subjective sleep quality 1–5 (optional) |
| `stress_level` | INTEGER | Subjective stress level 1–5 (optional) |
| `created_at` | TEXT | Auto-set via `datetime('now')` |

### Settings Table

Key-value store for user preferences: baseline window, verdict thresholds, paired device. Also stores internal state like `schema_version` and `onboarding_complete`.

## Testing

```bash
npm test
```

Unit tests covering all business logic:

| Module | What's Covered |
|--------|---------------|
| `hrv/metrics` | rMSSD, SDNN, mean HR, pNN50, edge cases |
| `hrv/artifacts` | Artifact detection & filtering, boundary conditions |
| `hrv/baseline` | Median computation, window filtering, outlier robustness |
| `hrv/verdict` | Threshold logic, insufficient baseline, custom thresholds |
| `ble/heartRateParser` | GATT parsing, 8/16-bit HR, RR units, sensor contact |
| `utils/date` | Date formatting, duration, streak calculation |
| `utils/csv` | CSV generation, escaping, null handling, numeric precision |

Tests are pure logic only (no React component rendering). Jest with ts-jest in Node environment.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture Overview](docs/ARCHITECTURE.md) | System diagrams, data flow, design decisions |
| [API Reference](docs/API.md) | Complete reference for all public exports |
| [Testing Guide](docs/TESTING.md) | Test architecture, coverage, conventions |
| [Sync Architecture](docs/SYNC.md) | E2E encrypted sync flow, providers, conflict resolution |
| [Cryptography](docs/CRYPTO.md) | Encryption protocol versions, wire formats, migration notes |
| [Product Requirements](hrv-readiness-dashboard-prd.md) | Original PRD |

## Key Design Decisions

- **Median baseline** over mean — more robust to outlier sessions
- **Population std dev** (÷N) for SDNN — RR intervals are the complete set, not a sample
- **pNN50 as percentage** (0–100) — not a 0–1 fraction
- **Heart Rate Service only** — works with any BLE HR monitor, not just Polar
- **5-minute recording** — per ESC guidelines for short-term HRV analysis
- **Local-only storage** — no privacy concerns, no network dependency
- **Camera PPG fallback** — extract RR intervals from fingertip camera readings when no chest strap is available
- **Authenticated encryption** — AES-256-GCM with a memory-hard scrypt KDF (N=2¹⁴) for backups, share bundles, and cloud sync (protocol v4); legacy v1–v3 blobs still decrypt for back-compat. See [`docs/CRYPTO.md`](./docs/CRYPTO.md).
- **Optional health platform sync** — write HRV data to Apple HealthKit / Android Health Connect when SDK is installed
- **Centralized UI strings** — all user-facing text in `constants/strings.ts` for i18n readiness

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, coding conventions, and the path from zero to your first PR.

## License

[MIT](LICENSE) © Jose David Baena
