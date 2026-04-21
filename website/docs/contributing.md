---
sidebar_position: 8
---

# Contributing

Thank you for your interest in contributing to the HRV Morning Readiness Dashboard! We welcome developers, designers, and enthusiasts to help improve this project.

Whether you're reporting bugs, suggesting features, writing documentation, or submitting code, your contribution is valued.

---

## Getting Started

### Development Setup

Follow these steps to get a local development environment running:

```bash
# Clone the repository
git clone https://github.com/josedab/hrv-dashboard.git
cd hrv-dashboard

# Install dependencies
npm install

# Copy environment template (optional — only needed for Sentry)
cp .env.example .env

# Generate native projects (first time only)
npx expo prebuild

# Run on iOS or Android (physical device required)
npm run ios        # iOS device
npm run android    # Android device

# Run tests
npm test
```

### Requirements
- **Node.js**: v18 or later
- **npm**: v9 or later
- **Xcode 15+** (macOS): For iOS development
- **Android Studio SDK 33+**: For Android development
- **Physical device**: Bluetooth testing requires real hardware (BLE does not work in simulators)
- **expo-dev-client**: The standard Expo Go app will **not** work — this app uses a development build

---

## Project Structure

```
src/
├── biofeedback/      # Real-time HRV biofeedback (coherence trainer)
├── ble/              # BLE scanning, connection, HR parsing, permissions, PPG
├── components/       # Reusable UI (VerdictDisplay, Sparkline, StatCard, etc.)
├── constants/        # Colors, defaults, verdict definitions, centralized UI strings
├── database/         # SQLite schema, session + settings repositories
├── experimental/     # Staged modules not yet wired to production
├── hooks/            # Custom React hooks (morning protocol, recording flow, persistence)
├── hrv/              # Core engine: metrics, artifacts, baseline, verdict, spectral, recovery
├── integrations/     # HealthKit/Health Connect sync, sleep auto-pull, CSV import wizard
├── navigation/       # React Navigation (bottom tabs + modal stack)
├── plugins/          # Sandboxed custom metric plugin system + marketplace
├── screens/          # App screens (18 total)
├── share/            # Coach share bundles with encrypted pairing codes
├── sync/             # End-to-end encrypted cloud sync (AES-256-GCM, scrypt KDF)
├── types/            # TypeScript interfaces (Session, HrvMetrics, Settings)
├── utils/            # UUID, date, CSV, backup, healthSync, notifications, profiles
└── workout/          # Workout generation & platform export (Strava, TrainingPeaks)

__tests__/            # Jest unit tests (mirrors src/ structure)
website/              # Docusaurus documentation site
examples/             # Standalone TypeScript examples
apps/coach-web/       # Next.js web app for coaches
watch-app/            # Apple Watch + Wear OS companion app skeletons
web-demo/             # Static single-file web demo
```

For a deep dive into architecture, see [Architecture Overview](./architecture/overview.md).

---

## Code Conventions

### TypeScript

- **Strict mode enabled**: All code must pass `npm run typecheck`
- **No implicit any**: Type all function parameters and returns
- **Explicit null/undefined**: No loose equality checks; use `===` and `!==`

Example:
```typescript
// ✓ Good
export function computeRmssd(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;
  const diffs = rrIntervals.slice(1).map((rr, i) => rr - rrIntervals[i]);
  const meanSquare = diffs.reduce((sum, diff) => sum + diff * diff, 0) / diffs.length;
  return Math.sqrt(meanSquare);
}

// ✗ Avoid: no type annotations, default export
export default function computeRmssd(rrIntervals) {
  // ...
}
```

### Naming & Exports

- **Named exports**: Prefer `export const` and `export function` over default exports (only `App.tsx` uses default)
- **camelCase files**: `sessionRepository.ts`, `useBleRecording.ts`
- **PascalCase components**: `HomeScreen.tsx`, `VerdictDisplay.tsx`
- **camelCase functions/variables**: `computeRmssd()`, `isValidRrInterval`

```typescript
// src/hrv/metrics.ts
export function computeRmssd(rrIntervals: number[]): number { ... }
export function computeSdnn(rrIntervals: number[]): number { ... }

// ✗ Avoid: default export
export default function hrv(rr: number[]) { ... }
```

### Path Aliases

Always use `@/` alias for local imports:

```typescript
// ✓ Good
import { computeRmssd } from '@/hrv/metrics';
import { useBleRecording } from '@/ble/useBleRecording';
import { COLORS } from '@/constants/colors';

// ✗ Avoid
import { computeRmssd } from '../../hrv/metrics';
```

### Theming

All colors come from `src/constants/colors.ts`. Dark theme only (background `#0F172A`, text `#F8FAFC`, accent `#3B82F6`).

---

## Testing

### Test Runner
- **Framework**: Jest + ts-jest
- **Environment**: Node (not jsdom)
- **Coverage thresholds**: 60% branches, 70% lines/functions/statements
- **Current suite**: 1,000+ tests across 65+ suites

### Writing Tests

Tests cover **pure domain logic** — HRV calculations, readiness logic, BLE parsing, encryption, plugins, import parsers. No React component rendering tests.

Tests live in `__tests__/` mirroring the `src/` directory structure:

```typescript
// __tests__/hrv/metrics.test.ts
import { computeRmssd, computeSdnn } from '../../src/hrv/metrics';

describe('computeRmssd', () => {
  it('computes rMSSD for valid RR intervals', () => {
    const rr = [800, 810, 790, 820, 800];
    const result = computeRmssd(rr);
    expect(result).toBeCloseTo(17.32, 1);
  });

  it('returns 0 for fewer than 2 intervals', () => {
    expect(computeRmssd([800])).toBe(0);
  });
});
```

**Important**: Never use `Math.random()` for noise/jitter in tests. Use a seeded LCG for deterministic assertions.

### Running Tests

```bash
# Run all tests
npm test

# Watch mode (rerun on file change)
npm run test:watch

# Coverage report
npm run test:coverage

# Run a single test file
npx jest __tests__/hrv/metrics.test.ts
```

---

## Submitting Changes

### 1. Fork & Branch

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/hrv-dashboard.git
cd hrv-dashboard

# Create a feature branch
git checkout -b feature/my-feature
# or for bugs
git checkout -b fix/my-bugfix
```

### 2. Make Changes

- Write code following [Code Conventions](#code-conventions) above
- Add/update tests for domain logic changes
- Update documentation if behavior changes
- Run quality checks: `make check` (or individually: `npm run lint && npm run typecheck && npm test`)

### 3. Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add sleep quality logging to session form
fix: correct SDNN calculation to use population stdev
docs: update troubleshooting FAQ
test: add edge case tests for artifact detection
refactor: simplify BLE hook state management
```

### 4. Push & Open PR

```bash
git push origin feature/my-feature
```

Then open a Pull Request on GitHub. Include:
- Clear title (from commit message)
- Description of changes
- Related issue(s) if applicable
- Screenshots/videos for UI changes

### 5. Code Review

- Maintainers will review within 3–5 days
- Address feedback and push new commits
- Once approved, PR will be merged

---

## Where to Contribute

Pure-logic modules in `src/hrv/`, `src/plugins/`, `src/sync/`, `src/share/`, and `src/workout/` are the easiest places to start — they have no React or native dependencies and are straightforward to test.

| Area | Difficulty | Example |
|------|-----------|---------|
| `src/hrv/` | Easy | Add a new time-domain metric |
| `src/plugins/reference/` | Easy | Write a new reference plugin |
| `src/utils/` | Easy | Improve CSV export format |
| `src/integrations/import/` | Medium | Add a new vendor parser |
| `src/ble/` | Hard | Requires physical BLE device |
| `src/screens/` | Hard | React Native UI, needs device testing |

---

## Code of Conduct

### Be Respectful
- Welcome people of all backgrounds
- Assume good intent; address misunderstandings privately first
- No harassment, discrimination, or hostility

### Be Constructive
- Provide specific, actionable feedback
- Suggest improvements, not just criticism
- Celebrate others' contributions

### Be Inclusive
- Use inclusive language
- Welcome questions and help newcomers
- Listen to diverse perspectives

**Report violations** to maintainers privately. We take all concerns seriously.

---

## Questions?

- **Issues & discussions**: [GitHub Issues](https://github.com/josedab/hrv-dashboard/issues)
- **Architecture questions**: See [Architecture Documentation](./architecture/overview.md)
- **Troubleshooting**: See [Troubleshooting Guide](./troubleshooting.md)

---

## Recognition

Contributors will be acknowledged in:
- `CONTRIBUTORS.md` file
- GitHub "Contributors" section
- Release notes for your contribution

Thank you for helping make HRV Dashboard better! 💚

