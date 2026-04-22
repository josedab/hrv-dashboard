# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0 (2026-04-22)


### Features

* add reusable UI components ([5e2b5fd](https://github.com/josedab/hrv-dashboard/commit/5e2b5fdacf995f9145362b901799ec563c260b45))
* add screens and navigation ([2296ca9](https://github.com/josedab/hrv-dashboard/commit/2296ca95f1b2017f1b5c564cd18a8636409ed555))
* add TypeScript types and app constants ([91970de](https://github.com/josedab/hrv-dashboard/commit/91970de4988ccd6e2491a0de08fa630bd9757dfe))
* add utility functions ([89c0643](https://github.com/josedab/hrv-dashboard/commit/89c064329d0a5ae2342a178a146e4255d3d10924))
* **app:** wrap root in SafeAreaProvider and replace emoji tab icons with Ionicons ([803be39](https://github.com/josedab/hrv-dashboard/commit/803be39f2cbf16985a20e529e260e182ee2223e0))
* **biofeedback:** HRV coherence trainer with Goertzel frequency analysis ([31740ea](https://github.com/josedab/hrv-dashboard/commit/31740ea3b63e5dbc9cb7355613b984e3a07f74f5))
* **ble:** add auto-reconnect and isStoppingRef guard to useBleRecording ([46f1a9f](https://github.com/josedab/hrv-dashboard/commit/46f1a9f4abb958228f832a3c1f9c74f4c125d73a))
* **ble:** add camera-based PPG signal processor ([978c120](https://github.com/josedab/hrv-dashboard/commit/978c120304fb1c5b525f4123664f8a62ceba48f4))
* **ble:** add connection timeout and retry with exponential backoff ([b5c30ec](https://github.com/josedab/hrv-dashboard/commit/b5c30ec4934c612181d82c0edb7f89c8c4338e57))
* **ble:** add heart rate range validation and clamp out-of-range values ([d121bd6](https://github.com/josedab/hrv-dashboard/commit/d121bd6a495ff96fd712416eafb4687c4cc2c724))
* **ble:** add multi-vendor device profiles with capability flags ([4a9a4e3](https://github.com/josedab/hrv-dashboard/commit/4a9a4e30602c3145a1abc85dcf511a10ae8c5b8c))
* **ble:** add physiological RR interval bounds and isValidRrInterval helper ([d639c94](https://github.com/josedab/hrv-dashboard/commit/d639c94e056c9524f147555d317d2b61d0dbc90f))
* **ble:** graduate device profiles and add useDeviceScanner hook ([3ebe386](https://github.com/josedab/hrv-dashboard/commit/3ebe38609a9f8a44e177383f982279165c4d269e))
* **camera:** improve accuracy banner and tag session source as camera ([ccdf63e](https://github.com/josedab/hrv-dashboard/commit/ccdf63ea5b84ded934c25c7ee7372c08d08e25a7))
* **coherence:** accept live BLE RR intervals and hide demo badge when connected ([9e15301](https://github.com/josedab/hrv-dashboard/commit/9e153017771072c3a831a5b10ee22b2934b1668d))
* **components:** add BreathingExercise and Toast components ([74c3f41](https://github.com/josedab/hrv-dashboard/commit/74c3f41929057fd4769cf1d069f61b25eaa7270d))
* **components:** add ConnectionPill, PassphraseModal, and Toast action button ([b872ba9](https://github.com/josedab/hrv-dashboard/commit/b872ba95fd62e08662932d967c84dd926d02c211))
* **components:** show baseline context in VerdictDisplay and memoize Sparkline ([82ce0b1](https://github.com/josedab/hrv-dashboard/commit/82ce0b13bad38ac8df6272bf6107f1543d3ac868))
* **constants:** add centralized UI strings module ([40f8e12](https://github.com/josedab/hrv-dashboard/commit/40f8e12e22610b750f549d107d435685545dce81))
* **database:** add schema v2 migration for sleep and stress columns ([821d5b3](https://github.com/josedab/hrv-dashboard/commit/821d5b3c2c713ebcfb53d913b0a201011fd0fe8e))
* **database:** add sleep/stress to session repository and fix localtime queries ([2159fb7](https://github.com/josedab/hrv-dashboard/commit/2159fb79a6e3b0d276572d277d3de4e25705d8a2))
* **database:** add threshold validation and wrap saveSettings in transaction ([d5f88fa](https://github.com/josedab/hrv-dashboard/commit/d5f88fa10ce76bdd76e01eaf018b1953d363194a))
* **db:** schema v4 – add source column, deleteSession, exclude camera from baseline ([eb8fa11](https://github.com/josedab/hrv-dashboard/commit/eb8fa1168b6e6f6eebd41700223df688cb326251))
* **history:** verdict filter chips and empty-state CTA ([573c6a6](https://github.com/josedab/hrv-dashboard/commit/573c6a60412db4f90f7b3cae94b21e66fb9f7434))
* **home:** add recovery score and weekly load display ([d0fa65e](https://github.com/josedab/hrv-dashboard/commit/d0fa65e1c9666f08d2d29652c6cadc6c28010fe7))
* **home:** collapsible secondary actions and recovery score info modal ([af83e9c](https://github.com/josedab/hrv-dashboard/commit/af83e9cfdc41bbcaf2f74b15925f5373f6f24739))
* **home:** display WorkoutCard after today's reading ([fce9596](https://github.com/josedab/hrv-dashboard/commit/fce9596127f833fa56557bbf12d5cf7876ed613f))
* **hrv:** adaptive per-user readiness thresholds via rolling percentiles ([c73de66](https://github.com/josedab/hrv-dashboard/commit/c73de6657d321a7c8a1a2945e67d4ff854921693))
* **hrv:** add adaptive verdict mode via computeVerdictWithMode ([c91f014](https://github.com/josedab/hrv-dashboard/commit/c91f014e4d0574082721eff31e657cd98c8b087d))
* **hrv:** add analytics, orthostatic, and recovery scoring modules ([8db3663](https://github.com/josedab/hrv-dashboard/commit/8db3663a53d5aed2b1c6553450bbd33df0601c58))
* **hrv:** add spectral, ANS balance, circadian, norms, prediction, and training stress modules ([ac81bba](https://github.com/josedab/hrv-dashboard/commit/ac81bba64c5f91df22dc98b2b70ce9c88e7656ef))
* implement BLE module for Polar H10 ([7a632e4](https://github.com/josedab/hrv-dashboard/commit/7a632e418529659e918b1a521206fc68cb6b1f9a))
* implement HRV computation engine ([16f029a](https://github.com/josedab/hrv-dashboard/commit/16f029a682601c71a1b5eba60ae11f03a14ef34f))
* implement SQLite database layer ([1de12fb](https://github.com/josedab/hrv-dashboard/commit/1de12fb6cc62e4b73a2411f8a0de630ded64bb6c))
* **import:** vendor importers for Whoop, Oura, Garmin, Elite HRV and HRV4Training ([905e8dc](https://github.com/josedab/hrv-dashboard/commit/905e8dc7ab07a3d02b5fdb0b09accf92aa93caa0))
* **integrations:** extract shared health SDK loader into dedicated module ([0047422](https://github.com/josedab/hrv-dashboard/commit/00474228ed263a4ece3d046323dda60308422c9d))
* **integrations:** graduate health two-way sync, sleep-strain, and data import to production ([0d85eea](https://github.com/josedab/hrv-dashboard/commit/0d85eea6b5289cc994052ed0ce688f6405695a4a))
* **integrations:** sleep/strain health pull and two-way HealthKit sync ([8ed7b39](https://github.com/josedab/hrv-dashboard/commit/8ed7b39861a68caf14e8a08a4d764a2e158501d4))
* **log:** pre-populate existing log data and show save confirmation ([c892a83](https://github.com/josedab/hrv-dashboard/commit/c892a8331048a15d07e758bae494087a83e2d6dd))
* **ml:** adaptive on-device verdict and AI coach brief generator ([0ecaa03](https://github.com/josedab/hrv-dashboard/commit/0ecaa03795d033448245a26fd1730f6dfd712e86))
* **navigation:** add Trends tab and Orthostatic/CameraReading routes ([c79628c](https://github.com/josedab/hrv-dashboard/commit/c79628c0a35e22503be3179322c79145553b974c))
* **nav:** register Import, Profiles, and MorningProtocol screens ([2d80518](https://github.com/josedab/hrv-dashboard/commit/2d80518ce1aae851fac7cae5afc67f317d6da9d5))
* **nav:** register SyncSettings, ShareCoach, Plugins and Coherence routes ([c30e3b6](https://github.com/josedab/hrv-dashboard/commit/c30e3b6325b9d7b854dbe2c2c282865dffda5609))
* **plugins:** add recovery-velocity and weekly z-score reference plugins ([299f009](https://github.com/josedab/hrv-dashboard/commit/299f009439c132a2757e2a6b7d51c818b3de3a1a))
* **plugins:** sandboxed custom metric plugin system with marketplace ([2861f46](https://github.com/josedab/hrv-dashboard/commit/2861f46adcc8a9e00b7836ca9843885bac03f20d))
* **reading:** add guided breathing phase before BLE recording ([ecd7183](https://github.com/josedab/hrv-dashboard/commit/ecd718379a18df6f30d3c245d8e22b9bf795f6d3))
* **reading:** auto-connect paired device and honor breathing exercise toggle ([302d528](https://github.com/josedab/hrv-dashboard/commit/302d5285e1c2b006f391838fdbbceb8d0228c3cc))
* **screens:** add infinite scroll pagination to HistoryScreen ([437a490](https://github.com/josedab/hrv-dashboard/commit/437a4906ec12b4adcef0b518c872aaaef162294e))
* **screens:** add scan timeout UI, rescan button, and reconnecting state ([a803c99](https://github.com/josedab/hrv-dashboard/commit/a803c99802a69eeca7867a3bfc3d2167b63eac2e))
* **screens:** add sleep hours, sleep quality, and stress level logging to LogScreen ([2818380](https://github.com/josedab/hrv-dashboard/commit/28183804f45a89c0d520bdcae39b3751e89033cf))
* **screens:** add Trends, Orthostatic, and CameraReading screens ([5714828](https://github.com/josedab/hrv-dashboard/commit/5714828adfc2e1fa456297c0946e55d8a9962712))
* **screens:** display sleep and stress data in SessionDetailScreen ([76f467a](https://github.com/josedab/hrv-dashboard/commit/76f467a4f110b27adf08e3b625749f711c341e75))
* **screens:** pass baseline context to VerdictDisplay in HomeScreen ([9d48c76](https://github.com/josedab/hrv-dashboard/commit/9d48c763a187690586e3406c45f58c3068999f00))
* **screens:** validate threshold consistency and disable invalid options in SettingsScreen ([66b8b3d](https://github.com/josedab/hrv-dashboard/commit/66b8b3dd0fe4d16fca94a9ae8a83994103843138))
* **session-detail:** delete with undo toast, edit log link, and RR plot ([05fa2b1](https://github.com/josedab/hrv-dashboard/commit/05fa2b1848fa6a821ad7f62a006118ca454ec0fd))
* **settings:** add navigation entries for Sync, Share, Plugins and Coherence ([4e25e62](https://github.com/josedab/hrv-dashboard/commit/4e25e62037926d39c0f28d14f52783dd09bceef6))
* **settings:** add notifications, backup/restore, and health sync settings ([e137df5](https://github.com/josedab/hrv-dashboard/commit/e137df5bf5abdbd33a793c5f2804f2b340be4762))
* **settings:** breathing toggle, PassphraseModal backup flow, app version ([191878a](https://github.com/josedab/hrv-dashboard/commit/191878a6bb954e67e165e2414dcb3e04aaf1fe3c))
* **share:** encrypted coach share bundles with time-boxed pairing codes ([9c08812](https://github.com/josedab/hrv-dashboard/commit/9c0881286b383038f967069835b83b3d518e6c86))
* **share:** split pairing code and session selection into sub-modules ([9a38e34](https://github.com/josedab/hrv-dashboard/commit/9a38e349493cde1dc6bec9876577b4688057d484))
* **strings:** expand UI strings for new features ([6308fab](https://github.com/josedab/hrv-dashboard/commit/6308fabfa18b94c801ff6a419e9820944dadccd2))
* **sync:** end-to-end encrypted cloud sync with Supabase and R2 providers ([d615aae](https://github.com/josedab/hrv-dashboard/commit/d615aae79d3a5dd946c7950e2f48e702c4318925))
* **team:** privacy-first group readiness aggregation with k-anonymity ([12a55e4](https://github.com/josedab/hrv-dashboard/commit/12a55e4bdcd24cc8e5e67380a47df016555de184))
* **trends:** add empty-state CTA, safe-area insets, and correlation card polish ([2f7deb1](https://github.com/josedab/hrv-dashboard/commit/2f7deb191a8a8754d00b6b3951ba1d53ba5b1210))
* **types:** add SessionSource type and breathingExerciseEnabled setting ([0cd243b](https://github.com/josedab/hrv-dashboard/commit/0cd243b9554a9d699600b5b86acd830e79574cbe))
* **types:** add sleepHours, sleepQuality, and stressLevel fields to Session ([bd93bb6](https://github.com/josedab/hrv-dashboard/commit/bd93bb68ca13cf68d98cde42d7fd72b878f05b94))
* **utils/notifications:** add cancelSafe helper and weekly digest notification ([ea5e441](https://github.com/josedab/hrv-dashboard/commit/ea5e441f5620686161757c3e90a050f71e055364))
* **utils:** add backup, notifications, profiles, health sync, and widget utilities ([330cae7](https://github.com/josedab/hrv-dashboard/commit/330cae7cf7fd4c0a42bb87560f49d45013f27d6b))
* **utils:** add getErrorMessage and fireAndForget error helpers ([d96d2be](https://github.com/josedab/hrv-dashboard/commit/d96d2be89671c640c3256a5c5c8e55f78f7302a7))
* **utils:** add HTML report generator and shareable readiness card ([1c87739](https://github.com/josedab/hrv-dashboard/commit/1c87739606ede15b4e6c8453139ad402ff13799e))
* **utils:** add localDateString, daysAgo helpers and DST-safe calculateStreak ([f70d8b2](https://github.com/josedab/hrv-dashboard/commit/f70d8b2c9cd69e8dfbd828c3d02deca981c4140f))
* **utils:** add sleep_hours, sleep_quality, and stress_level columns to CSV export ([ec5410c](https://github.com/josedab/hrv-dashboard/commit/ec5410c68ed93e1b025f20ddcdc02dac4b6f2b26))
* **utils:** add weekly digest notification and smart reminder timing ([c70cb5a](https://github.com/josedab/hrv-dashboard/commit/c70cb5a85c9fac7037e524a024d610f0ef194398))
* **utils:** integrate Sentry SDK in crashReporting, replace console stubs ([149a0f7](https://github.com/josedab/hrv-dashboard/commit/149a0f70618ea77bd92736c0ebf829794727d65c))
* **watch:** watch companion bridge with native Swift/Kotlin skeletons and golden vectors ([f41fbbc](https://github.com/josedab/hrv-dashboard/commit/f41fbbc356c7998e86b451b2ca02af90c268711a))
* **website:** add Docusaurus documentation site ([9eff406](https://github.com/josedab/hrv-dashboard/commit/9eff40604abc6327040f32b856448416a4be2e32))
* **web:** web dashboard adapters, coach Next.js app and static browser demo ([8b7c871](https://github.com/josedab/hrv-dashboard/commit/8b7c8712c83cc49b504c5285397c12768a97b0f7))
* **workout:** graduate exporters and extract prescription lookup table ([5b5637a](https://github.com/josedab/hrv-dashboard/commit/5b5637a79e313037b5538e82a6c291773d1a1289))
* **workout:** workout-of-the-day generator, exporters, push service and WorkoutCard ([1212ac1](https://github.com/josedab/hrv-dashboard/commit/1212ac17a578423f314b6d17a380a40efedd3b7b))


### Bug Fixes

* **a11y:** add accessibility attributes across components and screens ([d9b7cc8](https://github.com/josedab/hrv-dashboard/commit/d9b7cc87bee3a031e6f1e53ef63cc0d37bf18d80))
* **app:** handle onboarding DB save failure gracefully; add iOS privacy manifest ([de5435d](https://github.com/josedab/hrv-dashboard/commit/de5435da050774e45936f90f25454dcf14585ebd))
* **biofeedback/coherence:** skip non-positive RR values in resampling ([c2c6bff](https://github.com/josedab/hrv-dashboard/commit/c2c6bffffbce553fae953757f84c28e882a2b327))
* **ble:** miscellaneous BLE robustness improvements ([cf156fe](https://github.com/josedab/hrv-dashboard/commit/cf156fe509ff29d3a0e268fcf7de761f7c07c96d))
* **database:** improve error handling and concurrency safety ([e29c8de](https://github.com/josedab/hrv-dashboard/commit/e29c8de9a7067aab3605939cdfc05fe6137eb0fb))
* **db:** add schema migration v3 to create profiles table ([2c88743](https://github.com/josedab/hrv-dashboard/commit/2c88743cf8149ccdde75dde916a33a85d9632f31))
* harden error paths in crash reporting, db migration, screens, and components ([cc4c554](https://github.com/josedab/hrv-dashboard/commit/cc4c554f6a1732d29d78507768ffdccf8896f381))
* **healthSync:** replace any types with typed health SDK interface ([edbf40f](https://github.com/josedab/hrv-dashboard/commit/edbf40f67df8ca9cdc1e7da6baab7f87d5c0e9b1))
* **hrv/spectral:** represent undefined LF/HF ratio as null ([5338010](https://github.com/josedab/hrv-dashboard/commit/5338010f731f919080a806746e7c100b2c4a71ec))
* **hrv:** guard NaN/Infinity in metrics and add per-device artifact tolerance ([cae52dc](https://github.com/josedab/hrv-dashboard/commit/cae52dc5f3f17885a7f226a2e01867267cce100b))
* **hrv:** guard non-finite and invalid metric values ([2d58817](https://github.com/josedab/hrv-dashboard/commit/2d58817255e47b6677ec8043e9c3f589aeee4812))
* **hrv:** use noon-based DST-safe date arithmetic in baseline computation ([906c8d8](https://github.com/josedab/hrv-dashboard/commit/906c8d84bb6aa359021cf2e32cdd5bbc78ddef84))
* **integrations/healthAutoPull:** clamp sleep values from health SDK ([0fb7ee3](https://github.com/josedab/hrv-dashboard/commit/0fb7ee3ad10e147d3b8fbe047c4b398fcdbfbb79))
* **integrations/import:** validate timestamps in WHOOP CSV parser ([a2abc79](https://github.com/josedab/hrv-dashboard/commit/a2abc791779dd891e7c873e3c979847ddf0c5651))
* **screens:** improve error handling and async lifecycle safety ([c3499f2](https://github.com/josedab/hrv-dashboard/commit/c3499f2c26ec8ad99252132c83da5e4d99756653))
* **share,workout:** guard edge cases in sessions and exporters ([63fb47d](https://github.com/josedab/hrv-dashboard/commit/63fb47d30d1c67cfbd4f4e5a688404d0225e8583))
* **test:** use relative dates in widgetData rolling-window test ([ef94dda](https://github.com/josedab/hrv-dashboard/commit/ef94ddab6ec029561d6a7ed45d05546100a197df))
* **utils/backup:** clean up temp cache file after share sheet closes ([2ed58f0](https://github.com/josedab/hrv-dashboard/commit/2ed58f07ce06f8a7831fcf29c115ef79f78ceead))
* **utils:** handle non-finite values and edge cases ([a30af9e](https://github.com/josedab/hrv-dashboard/commit/a30af9e4ccf6732ac53b3753e2557b8b19ddd926))

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
