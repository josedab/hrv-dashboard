---
sidebar_position: 4
---

# Design Decisions

This document explains the key architectural and algorithmic decisions in the HRV Dashboard, and the reasoning behind them.

## 1. Median Baseline (Not Mean)

**Decision**: Use **median** RMSSD for baseline calculation, not mean.

**Rationale**:
- **Outlier robustness**: Median is resistant to extreme values. A single unusually high or low reading doesn't shift the baseline.
- **Stable trends**: A recovering athlete with gradually improving metrics won't see their baseline jump erratically.
- **Practical interpretation**: The "typical" morning RMSSD is more meaningful than a mathematical average skewed by outliers.

**Example**:
```
Last 30 readings (RMSSD): [42, 45, 48, 51, 200*, 44, 46, 49, ...]
Mean = 70.3 ms (skewed by outlier 200)
Median = 47 ms (representative of actual recovery trend)
```

*Implemention: `SessionRepository.getBaselineMetrics()` uses SQLite `percentile_cont()` or manual sorting for median.*

---

## 2. Population Std Dev (÷N) for SDNN

**Decision**: Calculate SDNN using **population standard deviation** (divide by N), not sample std dev (divide by N−1).

**Rationale**:
- **Complete dataset**: The RR intervals collected during a single ~5-minute recording are the *complete population* we're analyzing, not a sample of a larger population.
- **Consistency**: RMSSD and other metrics are calculated on the full recording; SDNN should follow the same principle.
- **Physiological accuracy**: In HRV analysis, the ESC Task Force and Polar documentation use population-based formulas.

**Formula**:
```
SDNN = sqrt( sum((RR_i - mean_RR)²) / N )  // ÷N, not ÷(N-1)
```

---

## 3. Five-Minute Recording Duration

**Decision**: Record for approximately **5 minutes** by default.

**Rationale**:
- **ESC Task Force Recommendation**: The European Society of Cardiology and North American Society of Pacing and Electrophysiology recommend 5 minutes as a standard short-term recording for HRV analysis.
- **Practical balance**:
  - Long enough: ~300 RR intervals for stable metric calculation
  - Short enough: Morning routine doesn't become burdensome
  - Reproducible: Easy for users to repeat consistently
- **Sleep inertia window**: 5 minutes aligns with typical post-wake autonomic nervous system settling period.

**Implementation**: `ReadingScreen` displays countdown or auto-stops at ~300 seconds.

---

## 4. Heart Rate Service Only (No PMD or ECG)

**Decision**: Support **BLE Heart Rate Service** only; skip Polar PMD and ECG protocols.

**Rationale**:
- **Universal compatibility**: Every Polar device (H10, H9, Sense, Pacer) supports Heart Rate Service (standardized Bluetooth SIG spec).
- **Simpler implementation**: No proprietary SDK; fewer dependencies.
- **RR intervals sufficient**: Heart Rate Service streams RR intervals, which is all we need for HRV metrics.
- **Maintenance burden**: Supporting multiple protocols (PMD, ECG) multiplies complexity, testing, and bug surface area.
- **Trade-off clarity**: We don't need raw ECG data; RR intervals are proven for HRV readiness assessment.

**Devices supported**: Polar H10, H9, Sense, Pacer, Verity Sense, and most other modern fitness trackers with BLE HR Service.

---

## 5. Local-Only Storage (No Cloud)

**Decision**: All data stored **locally on device** (SQLite); no cloud sync or accounts.

**Rationale**:
- **Privacy first**: Sensitive health data never leaves the device.
- **No internet dependency**: App works in airplane mode, offline, or with poor connectivity.
- **No user friction**: No account creation, login, password management, or Terms of Service.
- **Simpler architecture**: No backend server, authentication, or database maintenance.
- **Device backup**: iOS and Android OS backups automatically preserve app data.

**Trade-offs**:
- Users cannot sync across devices (intentional)
- CSV export available for data portability

---

## 6. Five-Beat Moving Median for Artifact Detection

**Decision**: Flag RR intervals as artifacts if they differ by **> 5 beats** from the **moving median**.

**Rationale**:
- **Noise immunity**: Median is robust to outliers; single erratic beat doesn't affect detection.
- **Sensitivity-stability balance**:
  - 5-beat threshold: typical physiological variance is ±3 beats
  - Catches real noise without over-filtering valid HRV
- **Adaptive**: Moving window adapts to heart rate changes during recording.
- **Computationally efficient**: Simple operation; no complex filtering.

**Example**:
```
RR intervals (ms): [600, 620, 1250, 615, 625]  // 1250 is likely artifact
Moving median (5-beat): ~615 ms
Difference: 1250 - 615 = 635 ms >> 5 beats (300+ ms)
Action: Flag 1250 as artifact, exclude from RMSSD/SDNN calculation
```

**Implementation**: `Artifact.ts` utility; called per RR interval in real-time.

---

## 7. No Strap Tightness Guidance

**Decision**: No in-app guidance on strap tightness; assume user knows to secure properly.

**Rationale**:
- **User experience**: Reduce cognitive load during onboarding
- **Documented**: Polar H10 manual clearly states "wear tightly on chest"
- **Signal quality**: Poor strap contact produces high artifact rates, which provides feedback
- **Future**: Could add artifact rate alerts in v2 if needed

---

## 8. Readiness Verdicts (Go Hard / Moderate / Rest)

**Decision**: Three-tier verdict based on **current RMSSD vs. baseline**.

**Thresholds**:
```
Go Hard:    RMSSD >= (baseline × 1.0)
Moderate:   RMSSD >= (baseline × 0.75) AND < (baseline × 1.0)
Rest:       RMSSD < (baseline × 0.75)
```

**Rationale**:
- **Physiological**: Higher RMSSD indicates parasympathetic tone (rest/recovery); lower RMSSD suggests sympathetic dominance (stress/fatigue).
- **Personalized**: Thresholds scale to each user's own baseline, not population norms.
- **Actionable**: Three options cover spectrum from high readiness to recovery needed.
- **Configurable**: Users can adjust multipliers in Settings if desired.

**Example**:
```
User's baseline RMSSD: 50 ms
Today's RMSSD: 52 ms
52 >= 50 × 1.0? YES → Verdict: "Go Hard"

User's baseline RMSSD: 50 ms
Today's RMSSD: 40 ms
40 >= 50 × 0.75 (37.5)? YES → Verdict: "Moderate"

User's baseline RMSSD: 50 ms
Today's RMSSD: 30 ms
30 >= 50 × 0.75 (37.5)? NO → Verdict: "Rest"
```

---

## 9. 30-Day Baseline Window (Default)

**Decision**: Use the **last 30 days** of readings to calculate baseline metrics by default.

**Rationale**:
- **Trend sensitivity**: 30 days captures seasonal/training phase changes without being overly reactive.
- **Minimum 5 readings**: Requires at least 5 sessions to compute baseline (prevents misleading metrics with just 1–2 readings).
- **Consistency**: Aligns with many HRV apps and research standards.
- **Configurable**: Users can adjust window in Settings if they prefer shorter/longer periods.

---

## 10. TypeScript Strict Mode

**Decision**: Enforce **TypeScript strict mode** across entire codebase.

**Rationale**:
- **Type safety**: Catches entire classes of errors at compile time (null, undefined, type mismatches).
- **Maintainability**: Self-documenting code; types serve as inline documentation.
- **Refactoring confidence**: Changing types surfaces all affected code immediately.
- **Production reliability**: Fewer runtime surprises; clearer crash traces when issues occur.

**Config** (`tsconfig.json`):
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

---

## 11. Path Aliases (@/* → src/*)

**Decision**: Use `@/*` path alias for all local imports.

**Rationale**:
- **Readability**: `import { readiness } from '@/domain/readiness'` is clearer than `../../../domain/readiness`
- **Refactoring**: Moving files doesn't break imports if they use the alias root.
- **Consistency**: Entire codebase uses one import style.

**Config** (`tsconfig.json`):
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

---

## 12. Dark Theme as Default

**Decision**: App uses dark theme as primary design; no light theme toggle.

**Rationale**:
- **Early morning use**: Reduces eye strain during pre-dawn readings (when app is typically used).
- **Battery efficiency**: OLED displays consume less power with dark pixels.
- **Visual hierarchy**: Dark theme is modern, clean, and focuses user attention.
- **Accessibility**: High contrast between text and background.

**Future**: Light theme could be added as accessibility option if needed.

