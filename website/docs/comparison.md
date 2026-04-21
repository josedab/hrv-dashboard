---
sidebar_position: 10
title: Why HRV Dashboard?
---

# Why HRV Dashboard?

How does the HRV Morning Readiness Dashboard compare to other HRV tracking options? This page explains what differentiates this project and helps you decide if it's right for you.

## The Problem

Athletes and active people who track HRV today face a choice between:

1. **Subscription-locked platforms** (Whoop, Oura) that require monthly fees and proprietary hardware
2. **Camera-based apps** (HRV4Training, EliteHRV) that are less accurate than ECG-derived measurements
3. **Manufacturer apps** (Polar Beat, Garmin Connect) that bury HRV data and don't give a clear readiness verdict

The Polar H10 is the most accurate consumer ECG sensor available — but Polar's own app doesn't provide a dedicated readiness workflow. The HRV Dashboard fills this gap.

## Comparison

| Feature | HRV Dashboard | Whoop | HRV4Training | EliteHRV | Oura |
|---------|:------------:|:-----:|:------------:|:--------:|:----:|
| **Cost** | Free (MIT) | $30/mo | $10 one-time | Free | $6/mo + ring |
| **Open source** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **BLE chest strap support** | ✅ | ❌ (proprietary) | ✅ | ✅ | ❌ (ring only) |
| **Camera PPG fallback** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Local-first / offline** | ✅ | ❌ | Partial | Partial | ❌ |
| **E2E encrypted sync** | ✅ (AES-256-GCM) | N/A | ❌ | ❌ | N/A |
| **Data ownership** | Full (SQLite + CSV) | Limited export | CSV export | CSV export | Limited |
| **Custom plugins** | ✅ (sandboxed JS) | ❌ | ❌ | ❌ | ❌ |
| **Spectral analysis** | ✅ (LF/HF/VLF) | ❌ | Partial | ✅ | ❌ |
| **Workout generation** | ✅ (Strava/TP/Intervals) | ✅ | ❌ | ❌ | ❌ |
| **Multi-athlete profiles** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Coach sharing** | ✅ (encrypted) | Team plan ($$$) | ❌ | Team plan | ❌ |
| **HealthKit/Health Connect** | ✅ (two-way) | ✅ | ✅ | ✅ | ✅ |

## Key Differentiators

### 1. Fully Open Source (MIT License)
Every line of code is auditable. No hidden data collection, no black-box algorithms. Fork it, modify it, self-host it — it's yours.

### 2. Local-First, Privacy-By-Default
Your health data lives on your device. Cloud sync is optional and end-to-end encrypted — the server never sees your plaintext data. No accounts needed for core functionality.

### 3. Works With Any BLE Heart Rate Monitor
Uses the standard Bluetooth Heart Rate Service (0x180D) — not locked to proprietary hardware. Polar H10, Garmin HRM-Pro, Wahoo TICKR, and dozens of others work out of the box.

### 4. Extensible Plugin System
Compute custom metrics with sandboxed JavaScript plugins. The built-in reference plugins cover Poincaré analysis, DFA-α1, and more. Write your own or install from the marketplace.

### 5. Science-Based Algorithms
- **Median baseline** (not mean) — robust to outliers
- **ESC-compliant** 5-minute recording duration
- **Population standard deviation** for SDNN (÷N, not ÷N-1)
- Thresholds informed by Marco Altini's research and HRV4Training methodology

### 6. No Subscription
Free forever. MIT licensed. No freemium tiers, no feature gates, no "upgrade to Pro" prompts.

## When to Choose Something Else

The HRV Dashboard isn't for everyone:

- **If you want passive 24/7 monitoring** — Whoop or Oura are better choices (they track HRV during sleep automatically)
- **If you don't want to wear a chest strap** — Oura Ring or Apple Watch provide wrist/finger-based HRV without a strap
- **If you need clinical-grade reporting** — this is a training tool, not a medical device
- **If you want a fully managed service** — this is a self-hosted app; you manage your own data

## Import Your Existing Data

Switching from another platform? The CSV import wizard supports:
- **Whoop** — CSV cycle data
- **Oura** — JSON daily readiness + sleep
- **Garmin** — CSV HRV stats
- **Elite HRV** — CSV exports
- **HRV4Training** — CSV exports

The baseline accelerator pre-computes your rolling baseline from imported data so you get verdicts on day one.
