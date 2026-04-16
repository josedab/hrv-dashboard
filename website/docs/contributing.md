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
git clone https://github.com/yourusername/hrv-dashboard.git
cd hrv-dashboard

# Install dependencies
npm install

# Set up native modules (required for BLE, SQLite)
npx expo prebuild

# Run on iOS or Android
npm run ios        # iOS simulator or device
npm run android    # Android emulator or device

# Run tests
npm test
```

### Requirements
- **Node.js**: v18 or later
- **npm**: v9 or later
- **Xcode** (macOS): For iOS development
- **Android Studio**: For Android development
- **Physical device**: Bluetooth testing requires real hardware (no simulator support)

---

## Project Structure (Quick Overview)

```
src/
├── app/                  # Navigation, screens, entry point
├── components/           # Reusable UI components
├── domain/               # Pure business logic (HRV calculations, readiness)
├── data/                 # Repositories, database queries
├── hooks/                # React hooks (BLE, database, state)
├── utils/                # Utilities (formatting, validation, artifacts)
├── theme/                # Dark theme colors, spacing
├── types/                # TypeScript interfaces (Session, Settings)
└── __tests__/            # Jest unit tests

website/                   # Docusaurus documentation site
├── docs/
├── sidebars.js
└── docusaurus.config.js

package.json              # Dependencies, scripts
tsconfig.json             # TypeScript strict mode config
jest.config.js            # Jest test runner config
```

For a deep dive into architecture, see [Architecture Overview](./architecture/overview.md).

---

## Code Conventions

### TypeScript

- **Strict mode enabled**: All code must pass `tsc --strict`
- **No implicit any**: Type all function parameters and returns
- **Explicit null/undefined**: No loose equality checks; use `===` and `!==`

Example:
```typescript
// ✓ Good
function calculateRMSSD(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) {
    throw new Error('At least 2 RR intervals required');
  }
  const diffs = rrIntervals.slice(1).map((rr, i) => rr - rrIntervals[i]);
  const meanSquare = diffs.reduce((sum, diff) => sum + diff * diff, 0) / diffs.length;
  return Math.sqrt(meanSquare);
}

// ✗ Avoid
function calculateRMSSD(rrIntervals) {  // No type annotation
  const diffs = rrIntervals.slice(1).map((rr, i) => rr - rrIntervals[i]);
  return Math.sqrt(diffs.reduce((sum, diff) => sum + diff * diff, 0) / diffs.length);
}
```

### Naming & Exports

- **Named exports**: Prefer `export const` and `export function` over default exports
- **Kebab-case files**: `session-repository.ts`, `use-ble-recording.ts`
- **PascalCase components**: `HomeScreen.tsx`, `ReadingCard.tsx`
- **camelCase functions/variables**: `calculateMetrics()`, `isReadinessValid`

```typescript
// src/domain/hrv-engine.ts
export function calculateRMSSD(rrIntervals: number[]): number { ... }
export function calculateSDNN(rrIntervals: number[]): number { ... }

// ✗ Avoid: default export
export default function hrv(rr: number[]) { ... }
```

### Path Aliases

Always use `@/` alias for local imports:

```typescript
// ✓ Good
import { calculateRMSSD } from '@/domain/hrv-engine';
import { useSessionRepository } from '@/hooks/use-session-repository';
import { colors } from '@/theme/colors';

// ✗ Avoid
import { calculateRMSSD } from '../../domain/hrv-engine';
import { useSessionRepository } from '../../../hooks/use-session-repository';
```

### Theming

All colors come from `@/theme/colors`. Dark theme only; no light mode.

```typescript
import { colors } from '@/theme/colors';

export function MyComponent() {
  return (
    <View style={{ backgroundColor: colors.background.primary }}>
      <Text style={{ color: colors.text.primary }}>Hello</Text>
    </View>
  );
}
```

---

## Testing

### Test Runner
- **Framework**: Jest + ts-jest
- **Environment**: Node (not jsdom)
- **Coverage target**: >80% for domain logic

### Writing Tests

Tests cover **pure domain logic** only (HRV calculations, readiness logic, validation). No UI or BLE integration tests.

```typescript
// src/domain/__tests__/hrv-engine.test.ts
import { calculateRMSSD, calculateSDNN } from '@/domain/hrv-engine';

describe('HRV Engine', () => {
  it('should calculate RMSSD correctly', () => {
    const rrIntervals = [600, 620, 610, 615];
    const rmssd = calculateRMSSD(rrIntervals);
    expect(rmssd).toBeCloseTo(10.54, 2);
  });

  it('should throw on insufficient data', () => {
    expect(() => calculateRMSSD([600])).toThrow();
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode (rerun on file change)
npm test -- --watch

# Coverage report
npm test -- --coverage
```

**Current test suite**: ~140 tests, all passing. Target: maintain or increase coverage with new features.

---

## Submitting Changes

### 1. Fork & Branch

```bash
# Fork the repository on GitHub
# Clone your fork
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
- Run tests: `npm test`

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
- Use inclusive language (avoid gendered terms)
- Welcome questions and help newcomers
- Listen to diverse perspectives

**Report violations** to maintainers privately. We take all concerns seriously.

---

## Common Contribution Types

### Bug Reports
Open an issue with:
- Clear title: "App crashes on iOS when exporting CSV"
- Steps to reproduce
- Expected vs. actual behavior
- Device/OS version
- Logs (if applicable)

### Feature Requests
Open an issue with:
- Use case: Why is this needed?
- Proposed behavior
- Mockups (if UI-related)

### Documentation
- Fix typos or unclear explanations
- Add examples or clarifications
- Improve architecture docs

### Code
- Fix bugs (submit PR with test demonstrating bug)
- Add features (discuss in issue first; larger features may need design feedback)
- Refactor for clarity/performance (with benchmarks)

---

## Questions?

- **Issues & discussions**: Use [GitHub Issues](https://github.com/yourusername/hrv-dashboard/issues)
- **Architecture questions**: See [Architecture Documentation](./architecture/overview.md)
- **Troubleshooting**: See [Troubleshooting Guide](./troubleshooting.md)

---

## Recognition

Contributors will be acknowledged in:
- `CONTRIBUTORS.md` file
- GitHub "Contributors" section
- Release notes for your contribution

Thank you for helping make HRV Dashboard better! 💚

