# Testing Guide

This document describes the testing architecture, conventions, and workflows for the HRV Morning Readiness Dashboard.

## Philosophy

Tests cover **pure business logic only** — no React component rendering, no snapshots, no UI assertions. The test boundary is the TypeScript function signature: inputs go in, outputs come out.

This keeps tests fast (full suite runs in ~16 seconds), deterministic (no device or network dependencies), and maintainable (no brittle snapshot churn).

## Quick Reference

```bash
npm test                    # Run all tests
npm run test:coverage       # Run with coverage report
npm run test:watch          # Watch mode (re-runs on file changes)
npx jest path/to/file       # Run a single test file
npx jest --testNamePattern "computeRmssd"  # Run tests matching a pattern
make check                  # Lint + typecheck + format + test (all gates)
```

## Test Architecture

```
__tests__/
├── biofeedback/         # Coherence trainer tests
├── ble/                 # BLE parsing, PPG, device profiles
├── components/          # Component smoke tests (no renders)
├── database/            # Database init & migrations
├── hooks/               # Custom hook logic tests
├── hrv/                 # Core HRV engine (metrics, artifacts, baseline, verdict, etc.)
├── integrations/        # Health platform & import wizard tests
├── plugins/             # Plugin host, marketplace, protocol, reference plugins
├── share/               # Encrypted share bundle tests
├── sync/                # E2E encryption & sync protocol tests
├── utils/               # Date, CSV, backup, profiles, notifications, etc.
└── workout/             # Workout generator & exporter tests
```

Tests mirror the `src/` directory structure. For every module at `src/foo/bar.ts`, the corresponding test lives at `__tests__/foo/bar.test.ts`.

## Current Metrics

| Metric | Value |
|--------|-------|
| Test suites | 67 |
| Total tests | 1,042 |
| Statement coverage | 85% |
| Branch coverage | 72% |
| Function coverage | 84% |
| Line coverage | 86% |

## Coverage Thresholds

Coverage thresholds are enforced in `package.json` under `jest.coverageThreshold`:

```json
{
  "global": {
    "branches": 60,
    "functions": 70,
    "lines": 70,
    "statements": 70
  }
}
```

CI will fail if coverage drops below these values. The HRV core engine (`src/hrv/`) maintains ~100% coverage.

## Configuration

- **Runner:** Jest with `ts-jest` preset
- **Environment:** `node` (not jsdom — no DOM needed)
- **Path alias:** `@/*` maps to `src/*` via `moduleNameMapper`
- **ESM mocks:** Pure-ESM packages (`@noble/ciphers`, `@noble/hashes`) are shimmed via `test-utils/` and wired through `moduleNameMapper` in `package.json`

### ESM Package Mocking

Some dependencies ship as pure ESM and can't be loaded by ts-jest's CommonJS pipeline. The workaround:

1. Create a thin adapter in `src/` that wraps the ESM package (e.g., `src/sync/aesGcm.ts`)
2. Create a Node `crypto`-backed mock in `test-utils/` (e.g., `test-utils/nobleAesGcm.ts`)
3. Wire the mock via `jest.moduleNameMapper` in `package.json`

The mocks produce byte-identical output to the real packages — they use Node's built-in `crypto` module which implements the same algorithms (AES-256-GCM, scrypt).

Current shims:
| Production module | Test shim | Algorithm |
|-------------------|-----------|-----------|
| `@noble/ciphers` | `test-utils/nobleAesGcm.ts` | AES-256-GCM |
| `@noble/hashes/scrypt` | `test-utils/nobleScrypt.ts` | scrypt (RFC 7914) |

## Writing Tests

### Conventions

1. **Test file location:** `__tests__/<module-path>.test.ts` mirroring `src/`
2. **Deterministic RNG:** Never use `Math.random()` for noise/jitter. Use a seeded LCG:
   ```ts
   let seed = 12345;
   function nextRandom(): number {
     seed = (seed * 1664525 + 1013904223) >>> 0;
     return seed / 0xffffffff;
   }
   ```
3. **Named imports:** Match the source module's named export style
4. **Descriptive test names:** Use `describe`/`it` with clear behavior descriptions:
   ```ts
   describe('computeRmssd', () => {
     it('returns 0 for fewer than 2 intervals', () => { ... });
     it('computes correctly for stable rhythm', () => { ... });
     it('returns NaN-safe result for non-finite inputs', () => { ... });
   });
   ```

### What to Test

| Module type | What to test | What NOT to test |
|-------------|-------------|------------------|
| `hrv/*` | Metric computation, edge cases, NaN handling, empty arrays | — |
| `ble/*` | GATT parsing, base64 decoding, RR validation | BLE hardware interaction |
| `database/*` | Schema creation, migrations, query correctness | Native SQLite driver |
| `sync/*` | Encrypt/decrypt round-trips, version dispatch, conflict resolution | Network/Supabase |
| `share/*` | Seal/unseal, pairing codes, expiry enforcement | — |
| `plugins/*` | Sandbox security, timeout enforcement, reference plugin output | — |
| `utils/*` | CSV escaping, date math, streak calculation, backup format | File system I/O |
| `components/*` | Smoke tests (prop validation, export shape) | Rendering, snapshots |

### Property-Based Tests

The codebase uses `fast-check` for property-based testing of HRV engine invariants:
- rMSSD is always non-negative
- SDNN is always non-negative
- Artifact detection array length matches input length
- Filtered intervals are always a subset of input

See `__tests__/hrv/metrics.test.ts` for examples.

### Adding Tests for a New Module

1. Create `__tests__/<path>/<module>.test.ts`
2. Import only the public API (named exports)
3. Cover: happy path, edge cases (empty input, single element), boundary values, error paths
4. Run `npm run test:coverage` and verify the new module meets thresholds
5. For crypto/encoding modules: add round-trip tests (encrypt → decrypt = original)

## CI Integration

Tests run in GitHub Actions (`ci.yml`) on every push and PR to `main`:
- Matrix: Node 18 + Node 20
- Steps: lint → typecheck → test (with coverage)
- Coverage artifacts uploaded for review
- CodeQL security scanning runs weekly + on PRs

## Debugging Test Failures

```bash
# Run a single file with verbose output
npx jest __tests__/hrv/metrics.test.ts --verbose

# Run with Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand __tests__/hrv/metrics.test.ts

# Check for timing-sensitive issues
npx jest --runInBand  # Sequential execution (disables parallelism)
```

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Cannot find module '@noble/ciphers'` | ESM package not shimmed | Add to `test-utils/` and `jest.moduleNameMapper` |
| Flaky date-boundary test | Test runs near midnight | Use fixed dates, not `new Date()` |
| `ReferenceError: expo-* is not defined` | Native module in test scope | Mock the module or test the pure-logic wrapper |
