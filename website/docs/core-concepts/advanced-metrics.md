---
sidebar_position: 5
---

# Advanced Metrics

Beyond the core four metrics (rMSSD, SDNN, mean HR, pNN50), the HRV Dashboard computes advanced analytics that give you deeper insight into your autonomic nervous system and recovery.

## Frequency-Domain Spectral Analysis

While time-domain metrics like rMSSD measure beat-to-beat variability, **frequency-domain analysis** decomposes your heart rhythm into distinct frequency bands that correspond to different physiological systems.

### The Three Bands

| Band | Frequency Range | Physiological Origin |
|------|----------------|---------------------|
| **VLF** (Very Low Frequency) | 0.003–0.04 Hz | Thermoregulation, hormonal, metabolic |
| **LF** (Low Frequency) | 0.04–0.15 Hz | Mixed sympathetic and parasympathetic |
| **HF** (High Frequency) | 0.15–0.40 Hz | Parasympathetic (vagal) activity |

### LF/HF Ratio

The ratio of LF to HF power indicates your **autonomic balance**:

- **Low ratio (< 0.5)**: Parasympathetic dominant — relaxed, recovering
- **Balanced (0.5–2.0)**: Healthy autonomic balance
- **High ratio (2.0–4.0)**: Sympathetic dominant — stressed, activated
- **Very high (> 4.0)**: High sympathetic drive — possible overtraining or acute stress

### How It's Computed

The app uses a **Goertzel algorithm** (efficient single-frequency power detection) with 4 Hz resampling:

1. RR intervals are resampled to a uniform 4 Hz time series
2. Linear detrending removes slow drifts
3. Power is computed in each frequency band
4. Results include absolute power (ms²), relative power (%), and the LF/HF ratio

**Requirements**: At least 60 RR intervals, with 2+ minutes of recording needed for reliable VLF estimates.

## ANS Balance Dashboard

The ANS (Autonomic Nervous System) Balance feature classifies your sessions into **four zones** based on the LF/HF ratio:

| Zone | LF/HF Ratio | Color | Interpretation |
|------|-------------|-------|----------------|
| Parasympathetic | < 0.5 | 🟢 Green | Rest and recovery dominant |
| Balanced | 0.5–2.0 | 🔵 Blue | Healthy equilibrium |
| Sympathetic | 2.0–4.0 | 🟡 Amber | Fight-or-flight activation |
| High Sympathetic | > 4.0 | 🔴 Red | Acute stress or overtraining |

The dashboard also tracks your **trend direction** over time:
- **Sympathetic shift**: LF/HF ratio increasing >15% week-over-week
- **Stable**: Within ±15%
- **Parasympathetic shift**: LF/HF ratio decreasing >15%

## Recovery Score

The recovery score is a **composite metric** (0–100) that combines objective HRV data with subjective inputs:

| Component | Weight | Source |
|-----------|--------|--------|
| HRV (rMSSD vs. baseline) | 40% | Objective — from recording |
| Sleep quality | 25% | Subjective — 1–5 rating |
| Stress level | 20% | Subjective — 1–5 rating |
| Perceived readiness | 15% | Subjective — 1–5 rating |

### Score Interpretation

| Score | Rating | Meaning |
|-------|--------|---------|
| ≥ 80 | Excellent | Fully recovered, prime for intensity |
| 60–79 | Good | Adequate recovery, normal training appropriate |
| 40–59 | Fair | Partial recovery, moderate activity suggested |
| < 40 | Poor | Significant fatigue, prioritize rest |

The HRV component is capped at 1.2× baseline to prevent artificially high scores from outlier rMSSD readings.

## Next-Day Prediction

With 7+ days of data, the app predicts your **next-day rMSSD and verdict**:

1. **Linear regression** on the last 7 days of rMSSD values
2. **TSB adjustment** — if TSB < −15 (fatigued), a fatigue factor reduces the prediction; if TSB > +15 (fresh), a small boost is applied
3. **Physiological clamping** — prediction is bounded to 5–200 ms

### Confidence Levels

| History Length | Confidence |
|---------------|-----------|
| 7–13 days | Low |
| 14–30 days | Medium |
| 30+ days | High |

## Population Norms

Compare your HRV to **age and sex-stratified population percentiles**:

| Age Group | Available Percentiles |
|-----------|--------------------|
| 18–29 | p10, p25, p50, p75, p90 |
| 30–39 | p10, p25, p50, p75, p90 |
| 40–49 | p10, p25, p50, p75, p90 |
| 50–59 | p10, p25, p50, p75, p90 |
| 60+ | p10, p25, p50, p75, p90 |

Your rMSSD and SDNN values are ranked against the relevant population group and labeled:

- **Excellent** (≥ 90th percentile)
- **Above Average** (≥ 75th)
- **Average** (≥ 50th)
- **Below Average** (≥ 25th)
- **Low** (< 25th)

**Remember**: Personal trends matter more than population comparisons. A "Below Average" rMSSD that's consistent and trending up is better than an "Excellent" score that's dropping.

## Circadian Rhythm Analysis

Track your **recording time consistency** and identify your optimal measurement window:

- **Consistency score** (0–100): How regular your recording times are (standard deviation of recording hours)
- **Optimal window**: ±15 minutes from your average recording time
- **Time-HRV correlation**: Pearson correlation between time-of-day and rMSSD — some people show significant HRV variation based on when they measure

Requires at least 7 sessions for meaningful analysis.
