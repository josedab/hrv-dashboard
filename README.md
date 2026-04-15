# HRV Morning Readiness Dashboard

A mobile-first app that reads RR intervals from a Polar H10 chest strap each morning and produces a single, actionable readiness verdict for the day.

## Readiness Verdicts

| Verdict | Meaning |
|---------|---------|
| 🟢 **Go Hard** | HRV ≥ 95% of baseline — full intensity training |
| 🟡 **Moderate** | HRV 80–95% of baseline — train, avoid max effort |
| 🔴 **Rest or Easy** | HRV < 80% of baseline — prioritize recovery |

Baseline is computed as the **median rMSSD** over a rolling 7-day window (configurable: 5, 10, or 14 days).

## Tech Stack

- **React Native** (Expo bare workflow) — iOS & Android
- **expo-sqlite** — local-only storage, no backend
- **react-native-ble-plx** — Bluetooth Low Energy (Heart Rate Service 0x180D)
- **react-native-svg** — sparklines and charts
- **TypeScript** — strict mode throughout

## Getting Started

```bash
# Install dependencies
npm install

# Start Expo dev server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run tests
npm test
```

### BLE Requirements

- A Polar H10 (or any HR monitor advertising Heart Rate Service)
- iOS: Bluetooth permissions in Info.plist (already configured)
- Android: Location + Bluetooth permissions (already configured)
- Physical device required — BLE does not work in simulators

## Project Structure

```
src/
├── ble/              # BLE scanning, connection, RR interval parsing
├── components/       # Reusable UI: VerdictDisplay, Sparkline, StatCard, etc.
├── constants/        # Colors, defaults, verdict definitions
├── database/         # SQLite schema, session & settings repositories
├── hrv/              # HRV metrics, artifact detection, baseline, verdict
├── navigation/       # React Navigation (tabs + modal stack)
├── screens/          # Home, Reading, History, Log, Settings, SessionDetail
├── types/            # TypeScript type definitions
└── utils/            # UUID, date formatting, CSV export
```

## Core Algorithm

1. **Record**: Collect RR intervals via BLE Heart Rate Measurement (0x2A37) for 5 minutes
2. **Filter**: Detect artifacts using local moving median (flag intervals deviating >20%)
3. **Compute**: Calculate rMSSD, SDNN, mean HR, pNN50 from clean intervals
4. **Compare**: Current rMSSD vs. median of last 7 days' rMSSD values
5. **Verdict**: Apply threshold ratios to determine readiness state

## Data Model

All data stored locally in SQLite. No cloud, no accounts.

| Field | Type | Description |
|-------|------|-------------|
| rr_intervals | number[] | Raw RR intervals in ms |
| rmssd | number | Root mean square of successive differences |
| sdnn | number | Standard deviation of NN intervals |
| mean_hr | number | Average heart rate (bpm) |
| pnn50 | number | % of successive intervals >50ms apart |
| artifact_rate | number | Fraction of RR intervals flagged as artifacts |
| verdict | string | go_hard, moderate, rest, or null |

## Testing

```bash
npm test
```

140 unit tests covering:
- HRV metric computation (rMSSD, SDNN, mean HR, pNN50)
- Artifact detection and filtering
- Baseline computation (median-based)
- Verdict threshold logic
- BLE Heart Rate Measurement parsing
- CSV export formatting
- Date utilities and streak calculation

## License

Private — not yet licensed for distribution.
