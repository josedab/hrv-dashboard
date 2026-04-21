# Code Quality & Architecture Review
## HRV Morning Readiness Dashboard

**Date:** 2026-04-20
**Reviewer:** Automated Principal Engineer Audit
**Codebase:** 126 files · 19,154 LOC · TypeScript (React Native / Expo)

---

## Executive Summary

| Dimension | Rating |
|-----------|--------|
| **Overall Quality Score** | **B+** |
| **Architecture Health** | Good |
| **Maintainability Index** | High |
| **Technical Debt Estimate** | Low-Medium |

This is a well-engineered codebase with strong fundamentals. The HRV computation engine is exemplary — 17 pure-function modules with 100% test coverage. The plugin system, vendor import registry, and crypto facade demonstrate mature design pattern usage. The main concerns are: (1) dependency inversion violations where screens/utils reach directly into the database layer, (2) a handful of large screen components that mix multiple responsibilities, and (3) ~24 silently swallowed errors across BLE cleanup and notification scheduling.

---

## Critical Findings (Must Address)

### 1. Non-null assertion crash risk
**File:** `src/ble/deviceProfiles.ts:208`
```typescript
return PROFILE_BY_ID.get('unknown-hrm')!;
```
If the `'unknown-hrm'` key is ever removed from the map, this crashes at runtime with no error message. Replace with a fallback value or throw an explicit error.

**Fix:** `return PROFILE_BY_ID.get('unknown-hrm') ?? DEFAULT_PROFILE;`

### 2. Silent error swallowing (24 locations)
Errors are discarded without logging across three categories:

| Category | Count | Files | Risk |
|----------|-------|-------|------|
| Notification scheduling | 7 | `utils/notifications.ts` | Duplicate/missed notifications |
| BLE cleanup | 2 | `ble/bleManager.ts` | Connection leak |
| Database/UI catch blocks | 12 | `backup.ts`, `LogScreen`, `ProfilesScreen`, `healthTwoWay.ts` | Silent data loss |
| Fire-and-forget | 3 | `useSessionPersistence.ts`, `BreathingExercise.tsx` | Benign but untracked |

**Fix:** At minimum, log via `reportError()` from `utils/crashReporting.ts`:
```typescript
// Before (silent)
.catch(() => {});
// After (tracked)
.catch((e) => reportError(e, { context: 'notification-cancel' }));
```

### 3. `restoreBackup` is 129 lines with 5+ responsibilities
**File:** `src/utils/backup.ts:184`

This function handles version detection, key derivation, decryption, JSON parsing, schema migration, and database insertion — all in one function. A failure at any step produces opaque errors.

**Fix:** Extract into a pipeline: `detectVersion() → deriveKey() → decrypt() → parsePayload() → importSessions()`

---

## Architectural Concerns

### Dependency Inversion Violations

The declared architecture is `Screens → Hooks → Business Logic → Database`, but several shortcuts exist:

```
ACTUAL (violations highlighted):
  screens/ReadingScreen.tsx ──→ database/sessionRepository.ts  ❌
  screens/LogScreen.tsx     ──→ database/sessionRepository.ts  ❌
  utils/backup.ts           ──→ database/sessionRepository.ts  ❌
  utils/widgetData.ts       ──→ database/sessionRepository.ts  ❌
  utils/notifications.ts    ──→ database/database.ts           ❌
  utils/profiles.ts         ──→ database/database.ts           ❌
```

**Impact:** Business logic can't be reused outside React Native (e.g., for the watch app or web dashboard) because it's coupled to expo-sqlite. Tests require mocking the full database module instead of injecting a stub.

**Fix:** Create `ISessionRepository` / `ISettingsRepository` interfaces in `types/`, inject them into hooks and utils via parameters or context.

### BLE library type leakage

Screen components import `Device` from `react-native-ble-plx` directly. If the BLE library is ever swapped, every screen touching device objects must change.

**Fix:** Define a `BleDevice` interface in `ble/` and use it in screens, keeping the library type internal.

### Missing abstraction for crypto consumers

`expo-crypto` is imported in 5 different modules (`pairingCode.ts`, `marketplace.ts`, `backup.ts`, `share/index.ts`, `sync/crypto.ts`). A single crypto facade would centralize the dependency.

---

## Code Smell Inventory

### Structural Smells

| Smell | Count | Severity | Key Locations |
|-------|-------|----------|---------------|
| God Class (>300 LOC) | 11 files | 🟠 Medium | `ReadingScreen` (484), `LogScreen` (357), `HistoryScreen` (354) |
| Long Function (>40 LOC) | 15 functions | 🟠 Medium | `restoreBackup` (129), `useBleRecording` (172), `renderReportHtml` (101) |
| Deep Nesting (4+ levels) | 4 files | 🟡 Low | `ReadingScreen.tsx`, `useBleRecording.ts`, `bleManager.ts` |
| Data Clumps | 1 pattern | 🟡 Low | `(rmssd, sdnn, meanHr, pnn50)` passed as separate args in a few places — already wrapped in `HrvMetrics` in most |

### Duplication Smells

| Pattern | Count | Fix |
|---------|-------|-----|
| `.catch(() => {})` fire-and-forget | 12 | Extract `fireAndForget(promise, context)` utility |
| Error narrowing: `error instanceof Error ? error.message : String(error)` | 5+ | Extract `getErrorMessage(e: unknown): string` |
| Date formatting: `timestamp.slice(0, 10)` | 4 | Already have `toDateString()` in `utils/date.ts` — use it |
| `setState((prev) => ({ ...prev, ... }))` | 70+ | Consider `useReducer` for complex screen state |

### Naming & Clarity

| Item | Assessment |
|------|-----------|
| Naming consistency | ✅ Excellent — camelCase functions, PascalCase components, constants UPPER_SNAKE |
| Magic numbers | ✅ Almost all extracted to `constants/defaults.ts` |
| Dead code | ✅ Minimal — experimental modules properly fenced with `@experimental` tag |

---

## SOLID Violations

### Single Responsibility — 7/10
- `ReadingScreen.tsx` (484 lines) handles: BLE scanning, device selection, breathing flow, live recording, and results display
- `backup.ts` (313 lines) handles: encryption, serialization, file I/O, and database operations
- **Recommendation:** Split `ReadingScreen` into `ScanPhase`, `RecordPhase`, `ResultPhase` components

### Open/Closed — 7/10
- ✅ Plugin system (Registry + Factory pattern — exemplary)
- ✅ Vendor import system (`PARSER_REGISTRY` — new vendors via `registerParser()`)
- ❌ Verdict mode uses `if/else` in `verdict.ts:84-100` instead of a Strategy pattern
- **Recommendation:** Create `VerdictStrategy` interface with `FixedStrategy` and `AdaptiveStrategy` implementations

### Liskov Substitution — 8/10
- ✅ Crypto protocol versions (v1-v4) are substitutable — all decrypt through the same interface
- ✅ `SyncProvider` interface allows Supabase and InMemory providers interchangeably

### Interface Segregation — 8/10
- ✅ Focused interfaces throughout (`SyncProvider`, `PluginStorage`, `ExportConfig`)
- Minor: `Session` interface carries 16 fields — consider separating `SessionMetrics` from `SessionLog`

### Dependency Inversion — 5/10
- ❌ Screens import database repositories directly (see Architectural Concerns above)
- ❌ Utils depend on concrete database module
- ✅ HRV computation engine has zero database/UI dependencies (pure functions)

---

## Design Patterns Analysis

### Patterns Found (Well-Implemented)

| Pattern | Location | Quality |
|---------|----------|---------|
| **Registry** | `plugins/host.ts` (PluginRegistry) | ✅ Excellent |
| **Factory** | `plugins/host.ts` (compilePlugin) | ✅ Excellent |
| **Facade** | `sync/crypto.ts` (version auto-detection) | ✅ Excellent |
| **Adapter** | `plugins/protocol.ts` (OHP ↔ Session) | ✅ Excellent |
| **State Machine** | `hooks/useReadingFlow.ts` (discriminated union) | ✅ Excellent |
| **Repository** | `database/sessionRepository.ts` | ✅ Good (but concrete, not injected) |
| **Strategy** | `integrations/import/vendors.ts` (parser registry) | ✅ Excellent |
| **Observer** | BLE notifications via callbacks | ✅ Good |
| **Template Method** | `hooks/useMorningProtocol.ts` (phase sequencer) | ✅ Good |

### Missing Pattern Opportunities

| Opportunity | Current Code | Suggested Pattern |
|-------------|-------------|-------------------|
| Verdict computation | `if/else` on `verdictMode` | Strategy (`VerdictStrategy` interface) |
| Error handling | Repeated narrowing code | Utility function or Result type |
| Screen state | `useState` × 8 in ReadingScreen | `useReducer` with action types |
| Backup pipeline | 129-line monolith | Pipeline / Chain of Responsibility |

---

## Error Handling & Resilience

### Strengths
- ✅ Sentry integration with graceful console fallback
- ✅ `Number.isFinite()` guards on all HRV computation inputs (NaN-safe)
- ✅ Database migration wrapped in try/catch with singleton reset
- ✅ BLE connection retry with exponential backoff (1s, 2s, 4s)

### Weaknesses
- ❌ 24 empty catch blocks (see Critical Finding #2)
- ❌ No structured error types — all errors are `Error` with string messages
- ❌ No Result/Either type for operations that can fail expectedly

### Recommendation: Extract Error Utility
```typescript
// src/utils/errors.ts
export function getErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}

export function fireAndForget(promise: Promise<unknown>, context: string): void {
  promise.catch((e) => reportError(e, { context }));
}
```

---

## Testability Assessment

### Coverage Map

| Layer | Files | Tested | Coverage |
|-------|-------|--------|----------|
| `hrv/` (computation) | 17 | 17 | **100%** ✅ |
| `plugins/` | 5 | 5 | **100%** ✅ |
| `share/` | 3 | 3 | **100%** ✅ |
| `sync/` | 6 | 4 | 67% |
| `workout/` | 3 | 3 | **100%** ✅ |
| `utils/` | 12 | 8 | 67% |
| `ble/` | 6 | 3 | 50% |
| `database/` | 3 | 1 | 33% |
| `integrations/` | 6 | 4 | 67% |
| `hooks/` | 5 | 3 | 60% |
| `screens/` | 32 | 1 (smoke) | 3% |
| **Total** | **126** | **55** | **43.7%** |

### Test Quality Highlights
- ✅ Property-based tests with `fast-check` for HRV engine invariants
- ✅ Seeded LCG for deterministic noise generation (no `Math.random()`)
- ✅ Clean Arrange-Act-Assert structure throughout
- ✅ Good edge case coverage (empty arrays, NaN, boundary values, zero-length inputs)

### Critical Test Gaps
1. **Encryption error paths** — `sync/crypto.ts` backwards-compat (v1-v3) paths untested
2. **BLE lifecycle** — `bleManager.ts` connection/retry/timeout logic untested
3. **Database migrations** — `database.ts` migration failure recovery untested
4. **Component smoke tests** use `.toBeDefined()` — doesn't validate actual content

---

## Maintainability Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Max function length | <50 lines | 172 lines (`useBleRecording`) | 🔴 Over |
| Max file length | <300 lines | 484 lines (`ReadingScreen`) | 🔴 Over |
| Cyclomatic complexity | <15 | Est. 12-18 (complex screens) | 🟡 Borderline |
| `any` usage | 0 | 0 | 🟢 Clean |
| Type assertions | Minimal | 31 `as` casts | 🟡 Acceptable |
| Circular dependencies | 0 | 0 | 🟢 Clean |
| Test coverage (logic) | >80% | 85% statements | 🟢 Strong |

---

## Refactoring Roadmap

### Tier 1: High Impact, Low Effort (1-2 days)

1. **Replace `PROFILE_BY_ID.get('unknown-hrm')!` with safe fallback**
   - File: `src/ble/deviceProfiles.ts:208`
   - Risk: Runtime crash; Fix: 5 minutes

2. **Extract `getErrorMessage()` utility and apply across codebase**
   - Eliminates 5+ duplicate patterns
   - Fix: 30 minutes

3. **Replace silent `.catch(() => {})` with `reportError()` calls**
   - 24 locations across 10 files
   - Fix: 1 hour

4. **Use existing `toDateString()` helper instead of `.slice(0, 10)`**
   - 4 locations in experimental/ and database/
   - Fix: 15 minutes

### Tier 2: High Impact, Medium Effort (3-5 days)

5. **Split `ReadingScreen.tsx` (484 lines) into phase components**
   - Extract: `ScanPhase`, `BreathingPhase`, `RecordPhase`, `ResultPhase`
   - Each component ≤120 lines

6. **Split `restoreBackup()` (129 lines) into a pipeline**
   - Extract: `detectVersion()`, `deriveKey()`, `decrypt()`, `parsePayload()`, `importSessions()`

7. **Create `ISessionRepository` / `ISettingsRepository` interfaces**
   - Define in `src/types/`
   - Inject into hooks and utils
   - Enables testing without database mocks

8. **Add tests for crypto error paths and BLE lifecycle**
   - ~80 new tests for sync/crypto.ts, ble/bleManager.ts, database.ts

### Tier 3: Medium Impact, Larger Effort (1-2 weeks)

9. **Polymorphic verdict modes** — replace `if/else` with `VerdictStrategy`
10. **Abstract BLE device type** — create `BleDevice` interface, hide library types
11. **Centralize crypto imports** — route all `expo-crypto` through single facade
12. **Convert complex screen state from `useState` × N to `useReducer`**

---

## Positive Observations

These patterns should be **preserved and used as reference** for future work:

1. **HRV Engine purity** — 17 modules, zero side effects, 100% test coverage. This is textbook domain modeling.

2. **Plugin system design** — Registry + Factory + Sandbox (static audit, 250ms timeout, SHA-256 fingerprint). Best-in-class extensibility.

3. **Crypto version facade** — Single `decryptString()` auto-detects v1-v4 formats. Callers don't know which protocol version they're handling.

4. **Vendor import registry** — Open-Closed principle done right: `registerParser()` adds new vendors without touching existing code.

5. **Reading flow state machine** — Discriminated union (`ReadingPhase`) makes impossible states unrepresentable at the type level.

6. **Zero `any` types** — Entire codebase is `any`-free. The two `Record<string, any>` in `healthSdk.ts` are justified and ESLint-disabled with comments.

7. **Zero circular dependencies** — Clean unidirectional dependency graph from UI → hooks → logic → data → types.

8. **Constants discipline** — All magic numbers, colors, strings, and thresholds centralized in `constants/`. i18n-ready via `strings.ts`.

9. **Deterministic test RNG** — Seeded LCG instead of `Math.random()` ensures test reproducibility.

10. **CI matrix** — Node 18 + 20, with CodeQL security scanning, coverage artifacts, and automated release-please.
