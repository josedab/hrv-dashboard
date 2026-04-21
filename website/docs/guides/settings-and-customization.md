---
sidebar_position: 4
title: Settings & Customization
---

# Settings & Customization

The Settings screen allows you to customize how the app calculates your HRV baseline and verdicts, configure your paired device, and review privacy settings.

## Baseline Window

The baseline window is the time period over which the app calculates your "normal" rMSSD. All verdicts are based on where your current rMSSD falls within this baseline distribution.

**Options**: 5, 7, 10, or 14 days (default is 7)

### Trade-offs

- **Shorter windows (5 days)**
  - *Pros*: More responsive. The baseline resets quickly if you're recovering or getting fatigued.
  - *Cons*: Noisier. Fewer data points mean greater influence from outliers. Better for tracking short-term changes.
  - *Use case*: You're just starting out and want quicker feedback; or you travel/change routine frequently.

- **7 days (default)**
  - A balanced middle ground. Enough data for stability, short enough to reflect recent changes.
  - Recommended for most athletes.

- **10 days**
  - Smoother baseline, better for identifying true trends.
  - Use if you have a stable routine and want less day-to-day noise.

- **14 days (longest)**
  - Maximum stability. Your baseline changes slowly, which means verdicts are more conservative.
  - *Use case*: You have a consistent routine and prefer a stable, less reactive baseline.

**Changing the window**: If you switch windows, the baseline recalculates immediately. You may see different verdicts for recent days as the calculation shifts.

## Verdict Thresholds

The app supports two verdict modes: **Fixed** (default) and **Adaptive**.

### Fixed Mode (Default)

Verdicts are calculated based on the **ratio** of your current rMSSD to your baseline median:

- **Go Hard threshold** (default: 95%)
  - rMSSD ≥ 95% of your baseline median = "Go Hard"
  - This means your HRV is at or near your personal norm — a great day to push hard.

- **Moderate threshold** (default: 80%)
  - rMSSD between 80–95% of your baseline = "Moderate"
  - rMSSD < 80% of your baseline = "Rest"

### Customizing Fixed Thresholds

You can adjust these ratios to match your goals:

- **More aggressive** (e.g., Go Hard at 90%, Moderate at 70%)
  - You'll get "Go Hard" and "Moderate" verdicts more often. Use this if you want to train harder and tolerate more fatigue.
  - Risk: You might ignore genuine recovery signals and overtrain.

- **More conservative** (e.g., Go Hard at 100%, Moderate at 90%)
  - "Rest" verdicts appear more frequently. Use this if you're recovering from injury, managing stress, or prefer to prioritize recovery.
  - Risk: You might miss training opportunities on days you're actually recovered.

### Adaptive Mode

Enable adaptive mode in Settings to switch from fixed ratios to **personal percentile-based cutoffs**:

- Requires **30+ days** of session history to activate
- Uses your historical rMSSD distribution (20th percentile = Rest, 65th percentile = Go Hard)
- With **10+ labeled sessions** (where you rated perceived readiness), Bayesian feedback adjusts cutoffs by ±10%
- Falls back to fixed thresholds if you have fewer than 30 days of data

**Default thresholds (95% and 80%) are science-backed and recommended for most users.** Only adjust if you have specific reasons and experience with HRV training.

## Paired Device

If you're using a Bluetooth heart rate monitor or smartwatch to measure HRV:

- **Paired Device ID**: Shows the remembered BLE (Bluetooth Low Energy) device ID.
- **Quick reconnection**: The app remembers your device. The next time you measure, the app automatically tries to reconnect to the same device, saving you time.
- **Forgetting the device**: If you want to pair a different device, you can forget the current pairing and initiate a new one from the measurement screen.

Ensure your Bluetooth device is nearby and powered on before starting a measurement for the fastest connection.

## Privacy

The HRV Morning Readiness Dashboard takes your privacy seriously:

- **All data is local**: Every HRV reading, subjective log, and calculated metric is stored on your device only.
- **No analytics**: We don't collect or track how you use the app, what verdicts you receive, or any health metrics.
- **No tracking**: No third-party trackers, no cookies, no fingerprinting.
- **Export only**: The *only* way your data leaves your device is if *you* choose to export it.
- **No account required**: You don't need to log in, create an account, or provide personal information. The app works completely offline.

Your health data belongs to you. That's our philosophy.

---

**Questions?** Refer back to [Daily Routine](./daily-routine.md) and [Understanding Your Data](./understanding-your-data.md) for guidance on using the app effectively.
