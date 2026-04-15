# PRD: HRV Morning Readiness Dashboard

## Overview

A focused mobile-first app that reads 5 minutes of ECG data from a Polar H10 each morning and produces a single, actionable readiness verdict for the day. The core idea is simple: take what the H10 already does well (accurate RR intervals via raw ECG) and surface it in a way that requires no interpretation from the user.

---

## Problem

Athletes and active people who track heart rate variability today face two problems:

1. Consumer HRV apps (HRV4Training, EliteHRV, Whoop) are either built on camera-based PPG (less accurate) or locked to proprietary hardware.
2. The Polar H10 is the most accurate consumer ECG sensor available, but Polar's own app buries HRV data and does not give a clear readiness output.

The result is a gap: the best sensor for the job has no good dedicated readiness app.

---

## Target User

Active adults who train consistently and want objective data to inform daily training decisions. This includes:

- BJJ practitioners
- Cyclists and runners
- Strength athletes
- Anyone managing load across multiple training modalities

Not targeting clinical users or medical use cases.

---

## Core User Flow

1. User wakes up. Puts on the H10. Opens the app.
2. App connects to H10 via BLE automatically.
3. User lies still for 5 minutes. App records RR intervals.
4. App computes HRV metrics and compares against the user's 7-day baseline.
5. App displays a single readiness verdict with supporting context.
6. User logs perceived readiness and planned training type (optional).
7. Session is saved to history.

Total interaction time: under 5 minutes including setup.

---

## Readiness Verdict System

Three states, no ambiguity:

| Verdict | Meaning |
|---|---|
| Go hard | HRV is at or above baseline. Full intensity training is appropriate. |
| Moderate | HRV is within normal variance below baseline. Train, but avoid max effort. |
| Rest or easy | HRV is significantly below baseline. Prioritize recovery. |

The verdict is computed using rMSSD (root mean square of successive RR differences), which is the most validated short-term HRV metric for athlete readiness and is readable in a 5-minute window.

### Baseline logic

- Baseline is a rolling 7-day average of the user's rMSSD.
- Requires a minimum of 5 days of readings before showing a verdict (shows raw rMSSD only until then).
- "Go hard" threshold: rMSSD >= 95% of baseline.
- "Moderate" threshold: rMSSD between 80% and 95% of baseline.
- "Rest or easy" threshold: rMSSD < 80% of baseline.

These thresholds are informed by the research of Marco Altini and the HRV4Training methodology, and are adjustable in settings.

---

## Metrics Computed

From raw RR intervals captured via the Polar PMD (Polar Measurement Data) BLE protocol:

| Metric | Description | Displayed |
|---|---|---|
| rMSSD | Primary HRV readiness metric | Yes, prominently |
| SDNN | Overall HRV variability | Yes, secondary |
| Mean HR | Average heart rate during measurement | Yes |
| pNN50 | % of successive RR intervals > 50ms apart | Yes, secondary |
| Artifact rate | % of RR intervals flagged as artifacts | Yes, with warning if > 5% |

The app does not show frequency-domain metrics (LF, HF, LF/HF ratio) in v1. These require longer recordings and introduce interpretation complexity without enough added value for this use case.

---

## BLE Architecture

The H10 communicates over BLE using two relevant GATT services:

- **Heart Rate Service (0x180D)**: Standard HR profile. Provides beat-to-beat RR intervals alongside HR in BPM.
- **Polar PMD Service**: Proprietary Polar service for raw ECG at 130Hz and ACC data.

For v1, the app uses the Heart Rate Service only. This avoids the complexity of the PMD protocol and still gives access to RR intervals, which is sufficient for rMSSD and all other time-domain HRV metrics.

PMD (raw ECG) support is deferred to v2, where it enables artifact detection and ectopic beat filtering at a finer level.

### BLE connection flow

1. Scan for BLE devices advertising Heart Rate Service.
2. Filter by device name prefix "Polar H10" or allow manual selection.
3. Connect and subscribe to Heart Rate Measurement characteristic (0x2A37).
4. Parse RR intervals from the characteristic notification packets.
5. Collect for 300 seconds (5 minutes). Stop early if user taps "Done" after 2 minutes minimum.

The Polar BLE SDK (iOS/Android) can be used to simplify this. Alternatively, `react-native-ble-plx` works for React Native with direct GATT access.

---

## Platform

React Native (Expo) for v1. Reasons:

- Single codebase for iOS and Android.
- `react-native-ble-plx` covers BLE needs.
- Expo managed workflow until BLE requires bare workflow.
- No backend required in v1 (all data stored locally with AsyncStorage or SQLite via `expo-sqlite`).

---

## Data Model

```
Session {
  id: string (uuid)
  timestamp: ISO 8601 (UTC)
  duration_seconds: number
  rr_intervals: number[] (ms)
  rmssd: number
  sdnn: number
  mean_hr: number
  pnn50: number
  artifact_rate: number
  verdict: 'go_hard' | 'moderate' | 'rest'
  perceived_readiness: 1-5 | null
  training_type: string | null
  notes: string | null
}
```

All data is local to the device in v1. No cloud sync, no accounts.

---

## UI Screens

### 1. Home / Today

- Large verdict display (the dominant element)
- rMSSD value with a sparkline of the last 7 days
- Today's mean HR and SDNN as secondary stats
- "Start reading" button if no reading yet today
- Date and streak counter

### 2. Reading Screen

- BLE connection status
- Live RR interval plot (streaming)
- Countdown timer (5:00)
- Artifact warning if rate exceeds 5%
- "Finish early" button (available after 2:00)

### 3. History

- List of past sessions with verdict, rMSSD, and date
- Tap a session to see full stats
- 30-day rMSSD chart at the top

### 4. Log (post-reading)

- Perceived readiness (1-5 scale, labeled)
- Training type picker (strength, BJJ, cycling, rest, other)
- Free text notes field
- "Save" button

### 5. Settings

- Baseline window (default 7 days, options: 5, 10, 14)
- Verdict thresholds (advanced toggle)
- Paired device management
- Export data as CSV

---

## What Is Not in v1

- Raw ECG visualization
- Cloud sync or multi-device
- Apple Health / Google Fit integration
- Social or sharing features
- Sleep tracking integration
- Coach or AI interpretation layer
- Notifications or reminders

These are v2 candidates based on usage feedback.

---

## Success Metrics

Since this is not a commercial product in v1:

- Consistent daily use (5+ readings per week)
- Correlation between verdict and actual training outcome (tracked via perceived readiness log)
- Low artifact rate across readings (indicates good H10 contact and technique)

---

## Open Questions

1. Should rMSSD baseline use median rather than mean to reduce outlier sensitivity?
2. Is a 5-minute reading window necessary, or does 2 minutes of good data produce stable enough rMSSD? (The Altini research suggests 1-minute orthostatic readings can work.)
3. How should the app handle days with no reading when computing the rolling baseline?
4. Is a React Native bare workflow acceptable from day one given BLE requirements, or start with Expo Go and migrate?

---

## References

- Altini M, Plews D. "What is behind the numbers: Providing context to better understand HRV-guided training." Frontiers in Sports and Active Living, 2021.
- Polar BLE SDK: https://github.com/polarofficial/polar-ble-sdk
- HRV4Training methodology: https://www.hrv4training.com/blog
- Camm AJ et al. "Heart rate variability: Standards of measurement, physiological interpretation, and clinical use." European Heart Journal, 1996.
