# Project Health Review — HRV Morning Readiness Dashboard

_Generated 2026-04-20 · Reviewer: Copilot CLI_

---

## Part 1: Project Identity

**Name & Purpose:** HRV Morning Readiness Dashboard is a React Native (Expo) mobile app that connects to a Polar H10 chest strap via BLE, records RR intervals each morning, computes HRV metrics (rMSSD, SDNN, pNN50, mean HR), and delivers an actionable readiness verdict (Go Hard / Moderate / Rest). All data stays on-device in SQLite with optional E2E-encrypted cloud sync.

**Target Users:** Endurance athletes (runners, cyclists, BJJ practitioners, CrossFit) who train 4–6 days/week and want an evidence-based daily decision on training intensity — specifically those frustrated by black-box readiness scores from Whoop/Oura who want to see the raw numbers and own their data.

**Value Proposition:** Full transparency — every metric is shown, nothing hidden behind a proprietary score — combined with zero-cloud-required, local-first privacy. No subscription, no account needed.

**Project Stage:** **Beta** — v1.0.0 tagged, full feature set built, 1,042 tests passing, but not yet deployed to App Store / Google Play (store submission config has placeholder values).

---

## Part 2: Dimensional Scoring

### 2.1 Code Quality & Architecture — **9/10** (Weight: 20%)

The codebase exhibits excellent separation of concerns: the HRV engine (17 modules, ~2,310 LOC) is pure business logic with zero React/UI/native imports. Database, BLE, and presentation layers are cleanly isolated — no circular dependencies detected across 126 source files. TypeScript strict mode is enabled with `noImplicitReturns`, `noFallthroughCasesInSwitch`, and `noUncheckedSideEffectImports`. Zero `any` types in the codebase. Zero TODO/FIXME/HACK comments. Named exports used universally (0 `export default`).

The dependency set is lean (26 production deps) and current — React Native 0.76.7, Expo 52, TypeScript 5.7. Crypto choices (@noble/ciphers, @noble/hashes) are best-in-class audited libraries. Minor weaknesses: 6 screen files exceed 300 LOC (ReadingScreen.tsx at 483 is the largest), and memoization (React.memo, useMemo) could be more aggressive in components.

**Recommendation:** Extract sub-components from the largest screen files (ReadingScreen, CameraReadingScreen, LogScreen) to improve maintainability and enable targeted memoization.

### 2.2 Test Coverage & Reliability — **9/10** (Weight: 15%)

1,042 tests across 67 suites, all passing. Coverage: 85% statements, 72% branches, 84% functions, 86% lines. The HRV engine core hits ~97% line coverage; constants and types are at 100%. Tests are behavior-focused (pure logic, no snapshots, no renders) — test philosophy explicitly avoids UI testing, which is appropriate for a logic-heavy app. Property-based testing via fast-check validates HRV engine invariants. Test-to-source LOC ratio is 1:1.88 (10,014 test LOC / 18,831 source LOC).

The weakest-covered modules are database (55% statements — because sessionRepository.ts involves native SQLite) and integrations (58% — health SDK mocking is complex). CI runs lint → typecheck → format → test with coverage on Node 18+20 matrix; coverage artifacts are uploaded. Pre-commit hooks enforce formatting and linting via lint-staged.

**Recommendation:** Add integration-level tests for sessionRepository.ts using an in-memory SQLite driver (expo-sqlite supports it) to close the database coverage gap from 55% → 80%+.

### 2.3 Documentation & Developer Experience — **9/10** (Weight: 10%)

Documentation is exceptionally thorough: 41-section API reference (API.md), system architecture with 10+ Mermaid diagrams (ARCHITECTURE.md), dedicated TESTING.md, SYNC.md, CRYPTO.md, 5 Architecture Decision Records, privacy policy, App Store reviewer notes, and a full Docusaurus website. README is comprehensive with badges, project structure, algorithm walkthrough, and data model. CONTRIBUTING.md provides a clear path from clone to PR in under 10 minutes.

DevContainer support enables one-click GitHub Codespaces setup. VS Code workspace settings auto-configure format-on-save and ESLint. Makefile provides `make check` as a single quality gate command. 3 standalone runnable TypeScript examples demonstrate the HRV engine outside React Native.

**Recommendation:** Add a `TROUBLESHOOTING.md` to the root docs (or promote the website's troubleshooting page) — BLE pairing issues are the #1 friction point for new users and contributors.

### 2.4 Security & Compliance — **8/10** (Weight: 15%)

Cryptographic implementation is production-grade: AES-256-GCM with scrypt KDF (N=2¹⁴, memory-hard), per-blob random salts, AEAD-bound timestamps preventing replay attacks, 4 protocol versions with full backwards compatibility. Plugin sandbox blocks 15 forbidden tokens (eval, require, fetch, etc.) with wall-clock timeout enforcement. No hardcoded secrets — Sentry DSN loaded from env vars. `.gitignore` excludes signing keys (`.jks`, `.p8`, `.p12`, `.key`).

Vulnerability exposure: 18 npm audit findings (1 moderate, 17 high), but **all are transitive** through Expo SDK build tooling — none affect runtime code. The xmldom CDATA injection (GHSA-wh4c-j3r5-mjhp) and tar vulnerability are in development dependencies only. Direct dependencies have zero known CVEs. Privacy policy addresses GDPR, CCPA, and HIPAA-adjacent concerns.

**Recommendation:** Upgrade Expo to v55+ when available to resolve the 17 transitive high-severity vulnerabilities, even though they don't affect runtime. The optics of `npm audit` showing 18 findings matter for contributor confidence.

### 2.5 Performance & Scalability — **7/10** (Weight: 10%)

The app follows a local-first architecture with SQLite WAL mode and indexed queries — no N+1 patterns detected. BLE subscriptions are properly cleaned up with returned cleanup functions. Timer and event listener cleanup is consistent across all 19 clearInterval/clearTimeout sites. The `useBleRecording` hook handles mid-recording reconnection with accumulated RR interval preservation.

However, React component memoization is sparse: only 1 React.memo wrapper (Sparkline), ~15 useMemo, ~59 useCallback. For a recording/charting app, this could cause unnecessary re-renders during live data streaming. No explicit performance profiling, benchmarks, or React DevTools flame graph evidence exists. Database pagination uses stable sort (`timestamp DESC, id DESC`) — good. The scrypt KDF takes ~50–100ms per session encryption — acceptable but noticeable at scale (syncing 500+ sessions would take 25–50 seconds).

**Recommendation:** Profile the live recording screen with React DevTools Profiler during a real BLE recording session, and add React.memo to frequently-rendered components (StatCard, ConnectionPill, RRPlot) to prevent re-render cascades from HR notification callbacks.

### 2.6 Operational Maturity — **7/10** (Weight: 10%)

Deployment infrastructure is set up (EAS build profiles for development/preview/production, auto-increment versioning, release-please automation) but not battle-tested — submission config still has placeholder values (`REPLACE_WITH_APP_STORE_CONNECT_APP_ID`). The Store Launch Checklist is comprehensive (11 sections, common rejection reasons table), but 5 of 11 sections are incomplete (assets, store copy, EAS config). Demo Mode for App Store review is implemented and documented.

Crash reporting uses Sentry (opt-in) with breadcrumbs, user context, and 20% trace sampling — but only if the user enables it. No structured logging framework beyond console.error/warn. No runbook for production incidents (though for a mobile app this is less critical than for a service). The `ErrorBoundary` component provides crash recovery UI with Sentry integration.

**Recommendation:** Complete the EAS submission profile configuration and do a dry-run TestFlight/Play Internal deployment to validate the entire build-submit-install pipeline before public launch.

### 2.7 Community & Ecosystem — **5/10** (Weight: 10%)

This is a single-developer project: 120 commits, all from one author (`josedab`). Bus factor is 1. No external contributors, no forks, no stars data available. However, the community infrastructure is professionally set up — CODEOWNERS, PR template (10-point checklist), 2 issue templates, Dependabot with grouped updates, CodeQL scanning — ready for contributors to arrive.

The ecosystem is impressively broad: BLE + camera PPG recording, 5 import vendors (Whoop/Oura/Garmin + 2 stubs), 3 export platforms (Strava/TrainingPeaks/Intervals.icu), 5 reference plugins, Apple Health + Health Connect two-way sync, watch companion skeletons (iOS + Wear OS), a coach web app skeleton, and a static web demo. Release cadence has one tagged release (v1.0.0) with a dense unreleased changelog.

**Recommendation:** Ship v1.1.0 to App Store and promote on r/AdvancedRunning, r/HRV, and Product Hunt to bootstrap the first 100 users and external contributors. The codebase is ready; distribution is the bottleneck.

### 2.8 Product-Market Fit & Positioning — **7/10** (Weight: 10%)

The problem-solution alignment is sharp: endurance athletes want to know whether to train hard today, and this app gives a clear, science-backed answer using ESC-recommended methodology. The "show your work" transparency (raw metrics visible, not hidden behind a score) differentiates from Whoop (subscription, proprietary) and Oura (ring-required, opaque scoring). The MIT license and local-first storage appeal to privacy-conscious users.

However, there's no evidence of real-world adoption yet — no case studies, no user testimonials, no download numbers. The app hasn't been submitted to either App Store. The competitive landscape includes established players (Whoop, Oura, Elite HRV, HRV4Training) with brand recognition. The free/one-time-purchase pricing is a strength against subscription fatigue but raises sustainability questions.

**Recommendation:** Define a go-to-market launch strategy targeting the "Whoop cancellation" crowd — users leaving $30/month subscriptions who want ownership of their data. Create before/after comparison content showing metric transparency vs. competitor black boxes.

---

## Part 3: Risk Register

| # | Risk | Severity | Likelihood | Score | Mitigation |
|---|------|----------|------------|-------|------------|
| 1 | **Bus factor of 1** — sole developer; no succession plan | Critical (4) | Likely (3) | **12** | Recruit 1–2 contributors via open-source community; document tribal knowledge in ADRs |
| 2 | **No App Store presence** — v1.0.0 tagged but never submitted; competitors gaining share | High (3) | Almost Certain (4) | **12** | Complete EAS config and submit to TestFlight + Play Internal within 30 days |
| 3 | **Expo SDK lock-in** — 18 transitive vulnerabilities tied to Expo 52; upgrade cadence dictated by Expo | Medium (2) | Likely (3) | **6** | Track Expo 55 release; plan SDK upgrade within 2 releases; evaluate bare React Native path |
| 4 | **BLE device compatibility** — only tested with Polar H10; other HR monitors may have parsing edge cases | Medium (2) | Possible (2) | **4** | Expand device profiles; add community-contributed device test reports |
| 5 | **Sustainability** — no revenue model; free/one-time purchase can't fund ongoing development | High (3) | Possible (2) | **6** | Consider premium plugin marketplace or coaching tier as optional revenue stream |

---

## Part 4: SWOT Analysis

```
┌─────────────────────────────────────────────┬─────────────────────────────────────────────┐
│ STRENGTHS                                   │ WEAKNESSES                                  │
│                                             │                                             │
│ 1. Production-grade crypto (AES-256-GCM +   │ 1. Bus factor of 1 — entire project          │
│    scrypt) with 4-version back-compat       │    depends on a single developer             │
│ 2. 1,042 tests at 85% coverage with strict  │ 2. Not yet deployed to any app store —       │
│    TypeScript (0 any types, 0 TODOs)        │    all code, no distribution                 │
│ 3. Privacy-first local storage with         │ 3. Limited real-device BLE testing matrix    │
│    optional E2E encrypted sync              │    (Polar H10 only confirmed)                │
│                                             │                                             │
├─────────────────────────────────────────────┼─────────────────────────────────────────────┤
│ OPPORTUNITIES                               │ THREATS                                     │
│                                             │                                             │
│ 1. Whoop subscription fatigue — users       │ 1. Established competitors (Whoop, Oura,    │
│    seeking $0 alternatives with data        │    Elite HRV) with brand recognition         │
│    ownership                                │    and marketing budgets                     │
│ 2. Plugin marketplace could become a        │ 2. Apple/Google health platform changes      │
│    platform for HRV researchers and         │    could break HealthKit/Health Connect       │
│    coaches                                  │    integrations without warning               │
│ 3. Watch companion apps (Apple Watch +      │ 3. BLE API changes in future React Native    │
│    Wear OS) would remove chest-strap        │    or Expo versions could require             │
│    friction                                 │    significant BLE layer rewrites              │
│                                             │                                             │
└─────────────────────────────────────────────┴─────────────────────────────────────────────┘
```

---

## Part 5: Executive Summary

### Scorecard

```
┌──────────────────────────────────────────────────────────────────────┐
│ PROJECT HEALTH SCORECARD                                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Code Quality & Architecture    (20%)  [9/10]  █████████░             │
│ Test Coverage & Reliability    (15%)  [9/10]  █████████░             │
│ Documentation & DevEx          (10%)  [9/10]  █████████░             │
│ Security & Compliance          (15%)  [8/10]  ████████░░             │
│ Performance & Scalability      (10%)  [7/10]  ███████░░░             │
│ Operational Maturity           (10%)  [7/10]  ███████░░░             │
│ Community & Ecosystem          (10%)  [5/10]  █████░░░░░             │
│ Product-Market Fit             (10%)  [7/10]  ███████░░░             │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│ WEIGHTED OVERALL SCORE:                                              │
│                                                                      │
│   (9×0.20) + (9×0.15) + (9×0.10) + (8×0.15) +                       │
│   (7×0.10) + (7×0.10) + (5×0.10) + (7×0.10)                         │
│ = 1.80 + 1.35 + 0.90 + 1.20 + 0.70 + 0.70 + 0.50 + 0.70            │
│ = 7.85 / 10                                        [7.85/10]        │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│ GRADE:   B+                                                          │
│ VERDICT: Exceptionally engineered but unshipped — distribution       │
│          is the bottleneck, not quality.                              │
└──────────────────────────────────────────────────────────────────────┘
```

### Bottom Line

**State of the Project:** This is a remarkably well-engineered solo project — 18,831 LOC of strict TypeScript with zero `any` types, 1,042 tests at 85% coverage, production-grade AES-256-GCM cryptography, 41-section API documentation, and a thoughtfully layered architecture with zero circular dependencies. The feature set is comprehensive (BLE + camera PPG recording, 5 reference plugins, 3 export platforms, E2E encrypted sync, watch companion skeletons, health platform integration). For a v1.0.0 single-developer project, the engineering quality is in the top percentile of open-source mobile apps. The gap is entirely in distribution and community — excellent code sitting in a repository with no users.

**Highest-Leverage Move:** Submit to the Apple App Store and Google Play within 30 days. The EAS config needs placeholder values replaced and a TestFlight dry-run, but the code itself is launch-ready (1,042 tests passing, demo mode for reviewers, privacy policy complete, store checklist documented). Every week the app sits unshipped is a week competitors solidify their position with athletes who would prefer a transparent, local-first alternative.

**Invest or Divest?** Invest — but redirect effort from feature development to distribution. The codebase has more features than most shipped apps (plugins, spectral analysis, coach narratives, adaptive thresholds, import/export, watch companions). The immediate returns come from shipping what exists, not building more. The bus-factor-of-1 risk should be addressed in parallel by actively recruiting contributors from the HRV/endurance-sport open-source community once the app has real users providing social proof.
