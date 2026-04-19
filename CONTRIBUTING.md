# Contributing to HRV Readiness Dashboard

Thanks for your interest in contributing! This document covers how to get set up and submit changes.

## Prerequisites

- **Node.js 18+** (see `engines` in `package.json`)
- **Physical device** — BLE does not work in iOS Simulator or Android Emulator
- **iOS**: Xcode 15+, CocoaPods (`sudo gem install cocoapods`)
- **Android**: Android Studio with SDK 33+
- **Heart rate monitor** — Polar H10 or any BLE monitor advertising Heart Rate Service (0x180D)

## Getting Started

```bash
# Clone and install
git clone <repo-url>
cd hrv-dashboard
npm install

# Copy environment template (optional — only needed for Sentry)
cp .env.example .env

# Generate native projects (first time only)
npx expo prebuild

# iOS: install CocoaPods
cd ios && pod install && cd ..

# Run on physical device
npm run ios     # or: npm run android
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm test` | Run all unit tests (~10 seconds) |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Lint TypeScript files |
| `npm run typecheck` | Run TypeScript compiler checks |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting without writing |
| `make check` | Run all quality checks at once (lint + typecheck + format + test) |
| `make help` | Show all available Makefile targets |

## BLE & Physical Device Notes

- **BLE requires a real device** — simulators/emulators do not support Bluetooth Low Energy
- **iOS provisioning** — you'll need an Apple Developer account and a provisioning profile to run on a physical iPhone
- **Android USB debugging** — enable Developer Options → USB Debugging on your Android device
- **Expo Dev Client** — the app uses `expo-dev-client` for native module support. The standard Expo Go app will not work.

## Code Style

- **Prettier** formats all code. Run `npm run format` before committing, or rely on the pre-commit hook.
- **ESLint** catches bugs and enforces TypeScript best practices. Zero warnings should exist on `main`.
- **TypeScript strict mode** — all code must pass `npm run typecheck`.
- **Named exports** everywhere (no default exports except `App.tsx`).
- **No `console.log` in business logic** — use `reportError()` from `src/utils/crashReporting.ts` for error reporting.

## Project Structure

The codebase is organized into focused modules. Key directories:

| Directory | Purpose | Pure Logic? |
|-----------|---------|:-----------:|
| `src/hrv/` | HRV computation engine (17 modules) | ✅ Yes |
| `src/ble/` | BLE scanning, connection, device profiles | ❌ No (native) |
| `src/integrations/` | HealthKit, Health Connect, CSV import | ❌ No (native) |
| `src/hooks/` | Custom React hooks (protocol, recording, persistence) | Partially |
| `src/plugins/` | Sandboxed custom metric plugin system | ✅ Yes |
| `src/sync/` | E2E encrypted cloud sync (AES-256-GCM) | ✅ Yes |
| `src/share/` | Coach share bundles with pairing codes | ✅ Yes |
| `src/workout/` | Workout generation and platform export | ✅ Yes |
| `src/utils/` | Backup, notifications, reporting, profiles | Mixed |
| `src/screens/` | React Native screens (18 total) | ❌ No (UI) |
| `src/components/` | Reusable UI components (12 total) | ❌ No (UI) |
| `src/experimental/` | Staged modules not yet wired to production | ✅ Yes |

Pure-logic modules in `src/hrv/`, `src/plugins/`, `src/sync/`, `src/share/`, and `src/workout/` are the easiest places to contribute — they have no React or native dependencies and are straightforward to test.

Refer to `docs/ARCHITECTURE.md` for diagrams and `docs/API.md` for the full API reference (41 sections). Architecture Decision Records are in `docs/adr/`.

## Writing Tests

Tests live in `__tests__/` mirroring the `src/` directory structure. The test philosophy is **pure logic only** — we test the HRV engine, parsers, utilities, and data layer, but not React components (no renders, no snapshots).

```bash
# Run a single test file
npx jest __tests__/hrv/metrics.test.ts

# Run tests matching a pattern
npx jest --testNamePattern "computeRmssd"

# Run with coverage
npm run test:coverage
```

When adding a new module to `src/`, add a corresponding test file in `__tests__/`.

## Branching & PRs

1. Branch from `main`
2. Make your changes
3. Ensure `npm run lint`, `npm run typecheck`, and `npm test` all pass
4. Open a PR against `main`
5. CI will automatically run lint + typecheck + tests

## Commit Conventions

Use clear, imperative commit messages:

```
fix: resolve BLE reconnection during active recording
feat: add orthostatic test screen
docs: update API reference for recovery module
test: add widget data unit tests
```
