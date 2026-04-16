---
sidebar_position: 2
---

# Recording Flow

## The 4 Phases of a Reading

Every HRV reading follows a predictable flow:

1. **Scanning** – The app searches for nearby Polar H10 devices via Bluetooth Low Energy (BLE).
2. **Connecting** – Once found, it establishes a connection and subscribes to heart rate notifications.
3. **Recording** – The app accumulates RR intervals (beat-to-beat times) for the recording duration.
4. **Processing** – After the recording ends, it detects artifacts, computes metrics, compares to baseline, and issues a verdict.

## Recording Duration

Following **ESC short-term HRV guidelines**, this app records for **5 minutes** by default. Five minutes is the standard window for reliable HRV assessment and provides a good balance between data richness and practical usability.

**Early finish is allowed:** After **2 minutes**, you can manually end the recording if needed. However, the full 5 minutes is recommended for the most stable metric estimates. The longer the recording, the more your rMSSD and SDNN stabilize.

## What Happens During Recording

```mermaid
sequenceDiagram
    participant User
    participant ReadingScreen
    participant BLE
    participant PolarH10["Polar H10<br/>(Chest Strap)"]
    participant HRVEngine["HRV Engine<br/>(Processing)"]
    participant SQLite["SQLite DB"]

    User->>ReadingScreen: Start recording
    ReadingScreen->>BLE: Scan & connect
    BLE->>PolarH10: BLE notifications enabled
    loop Every heartbeat
        PolarH10->>BLE: Send RR interval (ms)
        BLE->>ReadingScreen: RR data arrives
        ReadingScreen->>ReadingScreen: Accumulate RR intervals
        ReadingScreen->>User: Update timer countdown
    end
    User->>ReadingScreen: Stop or 5 min expires
    ReadingScreen->>HRVEngine: Send accumulated RR array
    HRVEngine->>HRVEngine: Artifact detection
    HRVEngine->>HRVEngine: Compute metrics (rMSSD, SDNN, Mean HR, pNN50)
    HRVEngine->>HRVEngine: Query baseline
    HRVEngine->>HRVEngine: Compare & determine verdict
    HRVEngine->>SQLite: Store reading
    HRVEngine->>User: Display result & verdict
```

During the 5-minute window:
- **RR intervals stream in** via BLE notifications from the Polar H10 (approximately one per heartbeat).
- **The app accumulates these** in memory, maintaining a growing array.
- **A visual countdown timer** keeps you informed of recording progress.
- **The connection stays active** — if the device is removed or connection is lost, an error is shown and the recording is cancelled.

## What Happens After Recording

Once the 5-minute timer expires (or you stop early), the app transitions to processing:

1. **Artifact Detection** – The HRV engine applies a 5-beat moving median algorithm to identify and flag ectopic beats, sensor noise, or movement artifacts. (See [Artifact Detection](./artifact-detection.md) for details.)

2. **Metric Computation** – Four metrics are calculated from the cleaned RR intervals:
   - rMSSD (primary readiness metric)
   - SDNN (overall variability)
   - Mean HR (heart rate in bpm)
   - pNN50 (percentage of large beat-to-beat differences)

3. **Baseline Comparison** – The app queries your rolling baseline (median rMSSD over the last 5–14 days, configurable). If you have fewer than 5 days of readings, no verdict is issued yet.

4. **Verdict Determination** – Your current rMSSD is compared to the baseline:
   - 🟢 **Go Hard**: rMSSD ≥ 95% of baseline
   - 🟡 **Moderate**: rMSSD 80–95% of baseline
   - 🔴 **Rest**: rMSSD < 80% of baseline

5. **Data Storage** – The reading (RR intervals, metrics, artifacts, verdict, timestamp) is saved to SQLite.

6. **Display Result** – You see your metrics, verdict, artifact rate, and tips for next time.

## Typical Reading Session

- **Start** → Scan (5–10 seconds) → Connect (2–5 seconds) → Recording (300 seconds or user-selected early finish)
- **End** → Processing (1–2 seconds) → Result displayed
- **Total time**: ~5–6 minutes from app open to verdict

If you encounter connection issues or artifacts are too high (>5%), you'll be prompted to try again with better electrode contact.
