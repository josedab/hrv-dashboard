# Landing Page Copy

Source-of-truth copy blocks for the marketing site. Each section is
plain markdown so designers can drop it into any framework.

## 1. Hero

> **Train when your body is ready. Rest when it isn't.**
>
> A 2-minute morning HRV reading turns into a clear Go / Moderate / Rest
> verdict, calibrated to **your** baseline — not a population average.
>
> Pair a Polar H10. Open the app. Done.
>
> [App Store] [Google Play]

## 2. The Problem

Every endurance athlete has overtrained at least once. The signals were
there: poor sleep, high resting HR, that "off" feeling — but no clear
threshold to act on.

Generic readiness apps slap a 0-100 number on you using someone else's
baseline. Ours uses **your** rolling 7-day median, with artifact-aware
math and conservative thresholds borrowed from peer-reviewed sport-
science literature.

## 3. The Solution

- **Trustworthy numbers**: rMSSD, SDNN, pNN50, artifact rate — all
  shown, never hidden behind a black-box score.
- **Personal baseline**: 7-day rolling median that ignores outliers.
- **Adaptive thresholds**: opt-in personal percentile cutoffs once you
  have 30 days of data.
- **No subscription, no account, no cloud**: SQLite on-device. Optional
  E2E-encrypted backup if you want it.
- **Coach mode** (free web): drop a backup file in your browser and
  see your athlete's 30-day heatmap.

## 4. Screenshots

- Reading screen with breathing animation
- Verdict card (Go Hard / Moderate / Rest)
- 30-day rMSSD trend with baseline band
- Settings → Privacy

## 5. FAQ

**Do I need a chest strap?**
A Polar H10 is recommended. The camera-based PPG fallback works but is
noticeably less accurate.

**Where is my data stored?**
On your phone, in SQLite. Nothing leaves the device unless you turn on
Apple Health sync, opt-in crash reporting, or configure cloud backup.

**Is there a subscription?**
No. The app is paid once or free (your choice — see store listing).

**Can I export my data?**
Yes. Settings → Export → CSV or JSON.

**How is the verdict computed?**
Today's rMSSD divided by your personal 7-day median. ≥ 95% → Go Hard,
≥ 80% → Moderate, < 80% → Rest. The thresholds become personal
percentiles once you have 30 days of data.
