---
sidebar_position: 2
---

# Getting Started

This guide walks you through installing the HRV Dashboard app and taking your first reading.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** – Download from [nodejs.org](https://nodejs.org)
- **Xcode 15+** (iOS) or **Android Studio SDK 33+** (Android)
- **Physical device** – BLE doesn't work on simulators; you need a real phone
- **BLE Heart Rate Monitor** – Polar H10, Garmin HRM-Pro, or any ANT+/BLE HR device compatible with your phone

## Installation

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/josedab/hrv-dashboard.git
cd hrv-dashboard
npm install
```

### 2. Set Up Native Build Artifacts

```bash
npx expo prebuild
```

This generates native iOS and Android directories. If you already have these, you can skip this step.

### 3. Start the Dev Server

```bash
npm start
```

You'll see a menu in your terminal. Choose your target:

- **iOS:** Press `i` to open Xcode simulator or use your physical device via [Expo Go](https://expo.dev/go)
- **Android:** Press `a` to open Android Emulator or deploy to your physical device

### 4. Run on Your Device

**For iOS:**
```bash
npm run ios
```

**For Android:**
```bash
npm run android
```

The app will compile and launch on your device.

## BLE Permissions

Your phone must grant the app permission to access Bluetooth. Permissions differ by OS and Android version:

| Platform | Permissions | Behavior |
|----------|-----------|----------|
| **iOS 13+** | `NSBluetoothPeripheralUsageDescription` | System dialog on first run; user taps "Allow" |
| **Android 12+** | `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` | Requested at app launch (runtime permissions) |
| **Android 10–11** | `ACCESS_FINE_LOCATION` | Required because BLE scanning uses location APIs |
| **Android 9 & below** | `BLUETOOTH` (manifest only) | No runtime prompt; always granted |

The app handles these requests automatically. If you deny permission, you'll see a message prompting you to enable Bluetooth in Settings.

## Your First Reading

### Step 1: Launch the App

Open the HRV Dashboard app on your phone. On first run, you'll see an **onboarding flow**:
- Welcome screen
- Privacy & data storage explanation (everything stays on your device)
- Permission prompts

Tap through and grant Bluetooth permissions.

### Step 2: Pair Your HR Monitor

The app's home screen shows a **Start Reading** button. Tap it:

1. The app scans for nearby BLE devices.
2. A list of HR monitors appears (you'll see device names like "Polar H10" or "Garmin HRM").
3. Tap your monitor to pair.
4. The app connects and shows "Connected" status.

### Step 3: Record Your Reading

Once connected:

1. Remain still and calm for ~5 minutes (this is your resting heart rate window).
2. The app collects your RR intervals and displays real-time heart rate on screen.
3. After 5 minutes, tap **Finish Reading**.

The app processes your RR intervals and displays your **readiness verdict**:
- 🟢 **Go Hard** – You're recovered; push hard today
- 🟡 **Moderate** – Keep it steady; avoid extremes
- 🔴 **Rest** – Your body needs recovery

### Step 4: View Your History

Navigate to **History** to see:
- Past readings with timestamps
- Your rolling 7-day baseline
- Trend graph (HRV over the past 2 weeks)

## Running Tests & Quality Checks

The codebase includes 140+ unit tests and a linter for code quality.

### Run Unit Tests

```bash
npm test
```

Tests cover:
- HRV metric calculations (RMSSD, SDNN, LF/HF)
- Baseline computation and rolling average logic
- Verdict logic (recovery state classification)
- Data persistence (SQLite interactions)

### Run the Linter

```bash
npm run lint
```

Checks for TypeScript errors, unused imports, and code style issues. Fix automatically:

```bash
npm run lint -- --fix
```

## Troubleshooting

**"BLE device not found"**
- Ensure your HR monitor is charged and in pairing mode.
- Restart the app and try again.

**"Permission denied"**
- Go to Settings → Apps → HRV Dashboard → Permissions → enable Bluetooth.

**"Connection drops during reading"**
- Move closer to your phone (Bluetooth range ~10m).
- Ensure no interference from WiFi or other BLE devices.

**Tests fail on first run**
- Run `npm install` again to ensure all peer dependencies are resolved.

## What's Next?

- Learn the science in [HRV Basics](./core-concepts/hrv-basics.md)
- Explore the [architecture](./architecture/overview.md) of the app
- Check out the [API Reference](./api/hrv-engine.md) if you're contributing
