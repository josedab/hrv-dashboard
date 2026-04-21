# Documentation Audit Report

_Generated 2026-04-20 · HRV Morning Readiness Dashboard_

## Executive Summary

| Dimension | Score | Notes |
|-----------|-------|-------|
| Coverage breadth | **A** | 12+ docs, 41-section API ref, 5 ADRs, Docusaurus site |
| Accuracy | **B** | 3 stale/incorrect sections found (see §2) |
| Inline JSDoc | **B+** | ~90% of exports documented; no `@example` or `@throws` blocks |
| Cross-references | **B-** | README omits 4 top-level directories; badge counts stale |
| Onboarding DX | **A-** | CONTRIBUTING.md excellent; `make help` discoverable |

**Overall: B+ (80/100)**

---

## 1. Stale or Incorrect Content

### 1.1 `docs/ARCHITECTURE.md` line 581 — Backup encryption description is stale

**Current text:**
> Encryption: SHA-256 CTR mode stream cipher with PBKDF2-like key derivation
> (1000 iterations of SHA-256 with salt).

**Actual code:** Backups are now at **protocol v4** using **AES-256-GCM** with
a **scrypt KDF** (`N=2¹⁴, r=8, p=1`). The SHA-256 CTR description applies to
v1/v2 (legacy read-only paths). The paragraph should match `docs/CRYPTO.md`.

**Proposed fix:**
```markdown
**Encryption:** AES-256-GCM with a memory-hard scrypt KDF (protocol v4).
Legacy v1–v3 blobs still decrypt for back-compat. See
[`docs/CRYPTO.md`](./CRYPTO.md) for the full wire format and version history.
```

### 1.2 `docs/ARCHITECTURE.md` line 592 — Health sync described as "write-only"

**Current text:**
> All sync is **write-only** — the app never reads health data from the platform

**Actual code:** `src/integrations/healthSleep.ts` reads sleep stages from
HealthKit/Health Connect, and `healthTwoWay.ts` implements bidirectional sync.

**Proposed fix:**
```markdown
- Supports **bidirectional sync**: writes HRV and heart rate samples to the
  platform health store; reads last-night sleep stages for recovery scoring
- Tracks synced session IDs in the settings table to avoid duplicate writes
```

### 1.3 `README.md` line 259 — "No cloud sync, no user accounts"

**Current text:**
> All data is stored locally in SQLite. No cloud sync, no user accounts.

**Actual code:** Optional E2E-encrypted cloud sync via Supabase exists
(`src/sync/`), with a full `SyncSettingsScreen`.

**Proposed fix:**
```markdown
All data is stored locally in SQLite. Optional end-to-end encrypted cloud sync
is available (see [Crypto docs](docs/CRYPTO.md)) but no user accounts are
required for core functionality.
```

### 1.4 `README.md` line 6 — Badge counts stale

| Badge | Current value | Actual value |
|-------|---------------|--------------|
| Tests | 1016 passing | **1042 passing** |
| Coverage | 85% | **85%** (accurate) |

---

## 2. Missing Documentation

### 2.1 No standalone `docs/TESTING.md`

Testing guidance is split across README.md (6 lines), CONTRIBUTING.md (15 lines),
and CLAUDE.md (3 lines). A dedicated testing guide would consolidate:
- Test architecture and philosophy
- Coverage thresholds and enforcement
- How to write tests for each module type
- Mock strategy for ESM packages
- Property-based testing with fast-check

**→ Created: `docs/TESTING.md` (see deliverable below)**

### 2.2 README project structure omits 4 top-level directories

The README's `Project Structure` section (line 98) shows only `src/`. Missing:

| Directory | Purpose |
|-----------|---------|
| `examples/` | 3 standalone TypeScript examples (HRV computation, spectral analysis, report generation) |
| `apps/coach-web/` | Next.js web app for coaches to monitor athlete HRV data |
| `watch-app/` | Apple Watch + Wear OS companion app skeletons |
| `web-demo/` | Static single-file web demo (no hardware needed) |

### 2.3 No sync architecture document

`docs/CRYPTO.md` covers wire formats and KDF details, but the higher-level
sync flow (conflict resolution, provider interface, relay model) is only
partially covered in `docs/API.md` and `docs/ARCHITECTURE.md`. A dedicated
`docs/SYNC.md` would be valuable.

### 2.4 `CLAUDE.md` architecture section is incomplete

The architecture tree in CLAUDE.md lists 8 directories but the actual `src/`
has 16:

**Missing from CLAUDE.md:**
`biofeedback/`, `hooks/`, `integrations/`, `plugins/`, `share/`, `sync/`,
`workout/`, `experimental/`

---

## 3. Inline JSDoc Audit

### Coverage by module

| Module | Exports documented | @param | @returns | @example | @throws | Priority |
|--------|-------------------|--------|----------|----------|---------|----------|
| `types/index.ts` | ✅ All | ✅ | ✅ | ❌ | — | Low |
| `hrv/metrics.ts` | ✅ All | ⚠️ Partial | ✅ | ❌ | ❌ | Medium |
| `hrv/artifacts.ts` | ✅ All | ✅ | ✅ | ❌ | ❌ | Low |
| `hrv/baseline.ts` | ✅ All | ✅ | ✅ | ❌ | ❌ | Low |
| `hrv/verdict.ts` | ✅ All | ✅ | ✅ | ❌ | ❌ | Low |
| `hrv/spectral.ts` | ⚠️ Partial | ⚠️ Partial | ✅ | ❌ | ❌ | Medium |
| `hrv/trainingStress.ts` | ✅ All | ✅ | ✅ | ❌ | ❌ | Low |
| `hrv/norms.ts` | ✅ All | ⚠️ Partial | ✅ | ❌ | ❌ | Medium |
| `hrv/coachNarrative.ts` | ⚠️ Partial | ⚠️ Partial | ✅ | ❌ | ❌ | Medium |
| `ble/bleManager.ts` | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial | ❌ | ❌ | **High** |
| `ble/heartRateParser.ts` | ✅ All | ✅ | ✅ | ❌ | ⚠️ Missing | Medium |
| `ble/ppgProcessor.ts` | ✅ All | ✅ | ✅ | ❌ | ❌ | Low |
| `database/database.ts` | ⚠️ Partial | ❌ | ❌ | ❌ | ❌ | **High** |
| `database/sessionRepository.ts` | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial | ❌ | ❌ | **High** |
| `sync/crypto.ts` | ✅ All | ✅ | ✅ | ❌ | ❌ | Medium |
| `sync/index.ts` | ✅ All | ✅ | ✅ | ❌ | ❌ | Low |
| `share/index.ts` | ✅ All | ✅ | ✅ | ❌ | ⚠️ Missing | Medium |
| `plugins/host.ts` | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial | ❌ | ❌ | Medium |
| `utils/backup.ts` | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial | ❌ | ❌ | **High** |
| `workout/generator.ts` | ✅ All | ⚠️ Partial | ✅ | ❌ | ❌ | Low |

### Systemic gaps

1. **No `@example` blocks** — Not a single file in the codebase uses `@example`.
   Priority additions: `computeHrvMetrics`, `computeVerdict`, `sealShare`,
   `processPpgSignal`, `compilePlugin`

2. **No `@throws` documentation** — Functions that throw (e.g.,
   `parseHeartRateMeasurement`, `openShare`, `decryptSessionBlob`,
   `restoreBackup`) don't document error conditions

3. **Internal helpers undocumented** — `linearRegression`, `scanBand`,
   `movingAverage`, `detectPeaks`, `pearsonCorrelation`, `connectWithTimeout`

4. **Database layer** — `getDatabase()` migration logic undocumented inline;
   `sessionRepository.ts` query functions lack `@param`/`@returns`

---

## 4. Cross-Document Consistency Issues

| Issue | Location | Fix |
|-------|----------|-----|
| Test count "598" in memories | CLAUDE.md memories | Update to **1042 tests, 67 suites** |
| "No cloud sync" vs optional sync | README.md:259 | Reword to "optional E2E-encrypted sync" |
| Backup v1 description in architecture | ARCHITECTURE.md:581 | Update to v4 (AES-256-GCM + scrypt) |
| "Write-only" health sync | ARCHITECTURE.md:592 | Bidirectional (reads sleep stages) |
| Experimental module paths | CLAUDE.md:72-81 | Verify paths match `src/experimental/` |
| Sync protocol v3 in memories | Agent memories | Now v4 (scrypt KDF migration) |

---

## 5. Recommended Actions (Priority Order)

### P0 — Accuracy fixes (stale content)
1. Fix ARCHITECTURE.md backup encryption description (§1.1)
2. Fix ARCHITECTURE.md health sync "write-only" claim (§1.2)
3. Fix README.md "No cloud sync" claim (§1.3)
4. Update README.md test badge count to 1042 (§1.4)

### P1 — Missing docs
5. Add `docs/TESTING.md` (created in this audit)
6. Add `examples/`, `apps/`, `watch-app/`, `web-demo/` to README project structure
7. Update CLAUDE.md architecture section with all 16 src/ directories

### P2 — Inline JSDoc improvement
8. Add `@example` blocks to top 5 functions
9. Add `@throws` to parser, crypto, and restore functions
10. Document `database.ts` migration logic and `sessionRepository.ts` queries
11. Document `utils/backup.ts` key derivation and version handling

### P3 — New documentation
12. Create `docs/SYNC.md` (sync architecture, conflict resolution, provider model)
13. Expand `examples/README.md` to cross-link from main README

---

## 6. What's Excellent (Keep Doing)

- **`docs/CRYPTO.md`** — Protocol versioning, wire formats, migration SQL, defense-in-depth notes. A model document.
- **`docs/API.md`** — 41 sections with type signatures, examples, and behavioral notes. Impressively thorough.
- **`docs/ARCHITECTURE.md`** — 10+ Mermaid diagrams covering system overview, data flow, navigation, module dependencies.
- **ADR system** — 5 well-structured ADRs with context, decision, and consequences.
- **CONTRIBUTING.md** — Clear onboarding path from clone to PR.
- **Docusaurus website** — Well-organized with core concepts, architecture, guides, and API sections.
- **Standalone examples** — Runnable TypeScript files showing HRV engine usage outside React Native.
