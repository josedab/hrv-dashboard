# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Frequency-domain HRV spectral analysis (LF/HF/VLF band power, LF/HF ratio)
- AI recovery coach narrative with template-based daily briefs
- Training Stress Balance (ATL/CTL/TSB) model for periodization
- Guided morning protocol (breathing → recording → log orchestrated flow)
- HTML/PDF report export for weekly and monthly summaries
- Comparative benchmarking with age/sex-stratified HRV population norms
- Multi-athlete profile switching with dedicated ProfilesScreen
- Smart notification timing inferred from session history
- Weekly digest notification with trend direction and streak count
- CSV import wizard for Whoop, Oura, and Garmin data migration
- Device profiles graduated to production (per-device artifact tolerance)
- Adaptive verdict thresholds (personal percentile-based cutoffs)
- HealthKit/Health Connect two-way sync (graduated from experimental)
- Sleep-strain fusion for enhanced recovery scoring
- Coherence screen live BLE mode (falls back to simulated demo)
- Autonomic Nervous System (ANS) balance dashboard with zone classification
- On-device next-day HRV trend prediction (linear regression + TSB adjustment)
- Morning protocol screen with step indicator and auto-advance
- Sleep architecture analysis (hypnogram builder, sleep-HRV correlation)
- Onboarding baseline accelerator (pre-compute baseline from imported data)
- Branded shareable verdict cards for social media
- Circadian rhythm mapping (recording consistency analysis + optimal window)
- 2 new reference plugins: Recovery Velocity, Weekly Z-Score (total: 5)
- Property-based tests using fast-check for HRV engine invariants
- Data-driven workout prescription table (`prescriptions.ts`)
- Recording orchestration state machine (`useRecordingOrchestrator`)
- Shared health SDK lazy-loading utility (`healthSdk.ts`)
- Architecture Decision Records (ADR-0001 through ADR-0005)
- VS Code workspace settings and extension recommendations
- `.devcontainer/devcontainer.json` for GitHub Codespaces
- Standalone examples: `hrv-computation.ts`, `spectral-analysis.ts`, `report-generation.ts`
- Component smoke tests for Toast, ConnectionPill, Sparkline, ReadinessSlider, CountdownTimer

### Changed
- `filterArtifacts()` now accepts `toleranceFactor` parameter for per-device tuning
- `computeVerdictWithMode()` unifies fixed and adaptive verdict paths
- `share/index.ts` split into focused modules (pairingCode, sessions, facade)
- `workout/generator.ts` refactored to data-driven Strategy pattern (371 → 103 LOC)
- Upgraded TypeScript 5.3 → 5.7 with `noUncheckedSideEffectImports`
- Upgraded ESLint 8 → 9 (flat config) with typescript-eslint v8
- Health SDK loading consolidated into shared `healthSdk.ts` utility
- Graduated 6 experimental modules to production (deviceProfiles, healthTwoWay, sleepStrain, import/vendors, import/wizard, workout/exporters)

### Fixed
- Flaky share test boundary date edge case
- ESLint/Prettier conflict in healthAutoPull test (block-scoped disable)
- Database migration crash on failure (added try/catch with singleton reset)
- NaN propagation in `computeRmssd()`, `computeSdnn()`, `computeMeanHr()` (added `Number.isFinite()` guards)
- Sentry.init() crash when SDK fails (wrapped in try/catch)
- Unhandled promises in SessionDetailScreen and BreathingExercise
- Unused catch variable in LogScreen
- Toast component implicit return for `noImplicitReturns` compliance
- Broken pushService import after exporter graduation

### Improved
- CI: Node 18+20 matrix, npm audit, coverage artifact upload, CodeQL, release-please, docs deploy
- DX: Dependabot, PR template, issue templates, CODEOWNERS, Makefile, dev container
- Test coverage: 598 → 1,030 tests across 66 suites (86% line coverage)
- Documentation: README project structure (14 dirs), API.md (41 sections), ARCHITECTURE.md (45 Mermaid nodes)
- Formatting: all files pass `prettier --check`
- Removed 6 graduated experimental duplicates and empty directories

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
- Privacy policy and App Store reviewer notes
