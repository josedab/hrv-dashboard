---
sidebar_position: 9
title: Changelog
---

# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

For the full changelog, see [CHANGELOG.md on GitHub](https://github.com/josedab/hrv-dashboard/blob/main/CHANGELOG.md).

## [Unreleased]

### Added
- Frequency-domain HRV spectral analysis (LF/HF/VLF band power, LF/HF ratio)
- AI recovery coach narrative with template-based daily briefs
- Training Stress Balance (ATL/CTL/TSB) model for periodization
- Guided morning protocol (breathing → recording → log orchestrated flow)
- HTML/PDF report export for weekly and monthly summaries
- Comparative benchmarking with age/sex-stratified HRV population norms
- Multi-athlete profile switching
- Smart notification timing inferred from session history
- Weekly digest notification with trend direction and streak count
- CSV import wizard for Whoop, Oura, and Garmin data migration
- Adaptive verdict thresholds (personal percentile-based cutoffs)
- HealthKit/Health Connect two-way sync
- Sleep-strain fusion for enhanced recovery scoring
- Biofeedback coherence trainer (live BLE mode)
- ANS balance dashboard with zone classification
- On-device next-day HRV trend prediction
- Sleep architecture analysis (hypnogram builder, sleep-HRV correlation)
- Onboarding baseline accelerator (pre-compute baseline from imported data)
- Branded shareable verdict cards for social media
- Circadian rhythm mapping (recording consistency analysis + optimal window)
- 5 reference plugins: Poincaré, FFT LF/HF, DFA-α1, Recovery Velocity, Weekly Z-Score
- Property-based tests using fast-check for HRV engine invariants
- Architecture Decision Records (ADR-0001 through ADR-0005)
- Standalone examples: `hrv-computation.ts`, `spectral-analysis.ts`, `report-generation.ts`

### Changed
- Upgraded TypeScript 5.3 → 5.7
- Upgraded ESLint 8 → 9 (flat config)
- Workout generator refactored to data-driven Strategy pattern

### Fixed
- NaN propagation in `computeRmssd()`, `computeSdnn()`, `computeMeanHr()`
- Database migration crash on failure
- Sentry.init() crash when SDK fails

### Improved
- Test coverage: 598 → 1,000+ tests across 65+ suites (86% line coverage)
- CI: Node 18+20 matrix, npm audit, coverage artifacts, CodeQL, release-please

## [1.0.0] - 2026-04-15

### Added
- BLE heart rate recording via Heart Rate Service (0x180D)
- HRV metrics computation (rMSSD, SDNN, mean HR, pNN50)
- Artifact detection with 5-beat moving median filter
- Readiness verdict (Go Hard / Moderate / Rest) with rolling baseline
- Camera PPG fallback for no-strap recording
- Encrypted backup/restore (AES-256-GCM, protocol v4)
- Cloud sync via Supabase with end-to-end encryption
- Coach share bundles with time-boxed pairing codes
- Workout-of-the-day generator with sport-specific prescriptions
- Coherence biofeedback trainer (Goertzel frequency analysis)
- Orthostatic HRV test (supine → standing comparison)
- Recovery score (HRV + sleep + stress + readiness composite)
- Weekly analytics with trend detection and correlations
- Onboarding flow with 4-slide carousel
- Dark theme UI with centralized color palette
- Docusaurus documentation website
