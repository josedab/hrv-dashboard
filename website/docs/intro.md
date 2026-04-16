---
sidebar_position: 1
slug: /
---

# Introduction

**Know your body's recovery status in 5 minutes.** The HRV Morning Readiness Dashboard uses heart rate variability from your BLE monitor to deliver a daily training verdict—so you know whether to push hard, dial it back, or rest.

## What This App Does

The HRV Dashboard is a React Native (Expo) mobile app that connects to your Bluetooth Low Energy (BLE) heart rate monitor, records your beat-to-beat intervals (RR intervals), computes standard HRV metrics, and returns a simple daily verdict about your readiness to train:

- **Captures RR intervals** via BLE from compatible monitors (Polar, Garmin, generic HR monitors)
- **Computes HRV metrics** including RMSSD, SDNN, and frequency-domain measures
- **Delivers daily readiness verdicts** based on your rolling baseline
- **Stores all data locally** on your device—no cloud, no syncing, full privacy
- **No subscriptions, no ads**—just pure recovery tracking

## Who It's For

- **Athletes** training for endurance or strength—track how well you're recovering between sessions
- **Coaches** managing multiple athletes' readiness without external platforms
- **Biohackers & fitness enthusiasts** curious about their nervous system and recovery patterns
- **Anyone** who owns a BLE HR monitor and wants local-only health tracking

## Your Daily Readiness Verdict

When you take a reading, the app gives you one of three verdicts:

| Verdict | Emoji | Meaning |
|---------|-------|---------|
| **Go Hard** | 🟢 | Your HRV is above your rolling baseline. You're recovered and ready for a hard session. |
| **Moderate** | 🟡 | Your HRV is near your baseline. Stick to steady-state work; avoid extreme efforts. |
| **Rest** | 🔴 | Your HRV is below baseline. Your body needs recovery. Easy activity or complete rest recommended. |

The verdict adapts over time: the app tracks your personal baseline, so what's "recovered" for you is personalized to your physiology.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **React Native (Expo)** | Cross-platform mobile app framework for iOS & Android |
| **expo-sqlite** | Local database for storing RR intervals, readings, and baselines |
| **react-native-ble-plx** | Bluetooth Low Energy communication with HR monitors |
| **react-native-svg** | Charts and data visualizations |
| **React Navigation 7** | Navigation between screens (home, onboarding, readings, history) |
| **TypeScript (strict mode)** | Type-safe, maintainable codebase |

## Next Steps

1. **Get set up:** See [Getting Started](./getting-started.md) for installation and your first reading.
2. **Understand HRV:** Head to [HRV Basics](./core-concepts/hrv-basics.md) to learn the science behind your verdicts.
