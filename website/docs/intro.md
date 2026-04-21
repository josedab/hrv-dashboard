---
sidebar_position: 1
slug: /
---

# Introduction

**Know your body's recovery status in 5 minutes.** The HRV Morning Readiness Dashboard uses heart rate variability from your BLE heart rate monitor to deliver a daily training verdict — so you know whether to push hard, dial it back, or rest.

## What This App Does

The HRV Dashboard is a React Native (Expo) mobile app that connects to your Bluetooth Low Energy (BLE) heart rate monitor, records your beat-to-beat intervals (RR intervals), computes scientifically validated HRV metrics, and returns a simple daily verdict about your readiness to train.

### Core Capabilities

- **BLE heart rate recording** — connects to any BLE HR monitor (Polar H10, Garmin HRM-Pro, Wahoo TICKR, etc.) via the standard Heart Rate Service (0x180D)
- **HRV metric computation** — rMSSD, SDNN, pNN50, mean HR, plus frequency-domain spectral analysis (LF/HF/VLF band power)
- **Actionable readiness verdicts** — 🟢 Go Hard, 🟡 Moderate, or 🔴 Rest based on your personal rolling baseline
- **Camera PPG fallback** — no chest strap? Record from your phone's camera as a less precise alternative
- **Local-first storage** — all data in SQLite on your device, no cloud required, no accounts needed

### Advanced Features

- **AI coach narrative** — daily recovery briefs with personalized training recommendations
- **Guided morning protocol** — breathing exercise → recording → subjective log, orchestrated in a 3-phase flow
- **End-to-end encrypted sync** — optional cloud sync using AES-256-GCM with a memory-hard scrypt KDF (protocol v4)
- **Coach sharing** — encrypted share bundles with time-boxed pairing codes for athlete-coach data sharing
- **Workout generation** — verdict-based workout prescriptions with export to Strava, TrainingPeaks, and Intervals.icu
- **Plugin system** — sandboxed custom metric plugins with a built-in marketplace (Poincaré, FFT LF/HF, DFA-α1, Recovery Velocity, Weekly Z-Score)
- **CSV import wizard** — migrate data from Whoop, Oura, or Garmin devices
- **HealthKit / Health Connect sync** — two-way sync with Apple Health and Android Health Connect
- **Multi-athlete profiles** — switch between athletes on a single device
- **Encrypted backup/restore** — `.hrvbak` files with AES-256-GCM encryption
- **Smart notifications** — morning reminders, streak protection, weekly digest
- **Training Stress Balance** — ATL/CTL/TSB model for periodization tracking
- **Biofeedback coherence trainer** — real-time HRV coherence training with Goertzel frequency analysis
- **Orthostatic HRV test** — supine vs. standing comparison protocol
- **Recovery scoring** — composite score from HRV + sleep + stress + subjective readiness

## Who It's For

- **Athletes** training for endurance, strength, or combat sports — track recovery between sessions
- **Coaches** managing multiple athletes' readiness with encrypted share bundles
- **Biohackers & fitness enthusiasts** curious about their autonomic nervous system
- **Anyone** who owns a BLE HR monitor and wants private, local-first health tracking

## Your Daily Readiness Verdict

When you take a reading, the app gives you one of three verdicts:

| Verdict | Emoji | Meaning |
|---------|-------|---------|
| **Go Hard** | 🟢 | rMSSD ≥ 95% of baseline. Full intensity training appropriate. |
| **Moderate** | 🟡 | rMSSD 80–95% of baseline. Train, but avoid max effort. |
| **Rest** | 🔴 | rMSSD < 80% of baseline. Prioritize recovery. |

The verdict adapts over time: the app tracks your personal baseline (median rMSSD over a rolling 7-day window), so what's "recovered" for you is personalized to your physiology. Adaptive thresholds based on your personal percentile history are also available.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **React Native (Expo)** | Cross-platform mobile app for iOS & Android |
| **expo-sqlite** | Local SQLite database (WAL mode) for all data storage |
| **react-native-ble-plx** | BLE communication with Heart Rate Service monitors |
| **react-native-svg** | Sparklines, RR plots, countdown timer visualizations |
| **React Navigation 7** | Bottom tabs + modal stack (18 screens) |
| **TypeScript (strict mode)** | Type-safe codebase with path aliases |
| **@noble/ciphers + @noble/hashes** | AES-256-GCM encryption and scrypt KDF for sync/backup/share |

## Next Steps

1. **Get set up:** See [Getting Started](./getting-started.md) for installation and your first reading.
2. **Understand HRV:** Head to [HRV Basics](./core-concepts/hrv-basics.md) to learn the science behind your verdicts.
3. **Explore advanced features:** Check out [Cloud Sync](./guides/cloud-sync.md), [Workout Generation](./guides/workout-generation.md), or [Plugins](./guides/plugins.md).
