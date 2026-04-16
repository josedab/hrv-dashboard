---
sidebar_position: 2
---

# BLE Layer

The BLE Layer provides Bluetooth Low Energy connectivity for heart rate monitors, primarily Polar H10 devices. It handles device scanning, connection management, data parsing, and automatic reconnection.

## Types & Interfaces

### BleConnectionState

Represents the current state of a BLE connection.

```typescript
type BleConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
```

---

### HeartRateMeasurement

Parsed heart rate data from GATT characteristic 0x2A37.

```typescript
interface HeartRateMeasurement {
  heartRate: number;              // beats per minute
  rrIntervals: number[];          // R-R intervals in ms
  energyExpended?: number;        // joules (optional)
  sensorContact?: boolean;        // skin contact status
}
```

---

### BleCallbacks

Callbacks for BLE state and data updates.

```typescript
interface BleCallbacks {
  onStateChange?: (state: BleConnectionState) => void;
  onDeviceFound?: (device: BleDevice) => void;
  onHeartRateUpdate?: (measurement: HeartRateMeasurement) => void;
  onError?: (error: Error) => void;
  onDisconnect?: () => void;
}
```

---

## Device Scanning

### scanForDevices

Scans for Bluetooth devices advertising the Heart Rate Service (0x180D).

```typescript
scanForDevices(
  onDeviceFound: (device: BleDevice) => void,
  timeoutMs?: number
): Promise<() => void>
```

**Parameters:**
- `onDeviceFound` — Callback invoked for each discovered device
- `timeoutMs` — Scan duration in milliseconds (default: 10000)

**Returns:**
- Promise resolving to a cleanup function that stops the scan

**GATT Service UUID:**
- Heart Rate Service: `0x180D`

**Example:**
```typescript
const stopScan = await scanForDevices((device) => {
  console.log(`Found: ${device.name} (${device.id})`);
}, 5000);

// Later...
stopScan();
```

---

### isPolarH10

Checks if a device is a Polar H10 heart rate monitor.

```typescript
isPolarH10(device: BleDevice): boolean
```

**Parameters:**
- `device` — BLE device object

**Returns:**
- `true` if device manufacturer is Polar and model contains "H10"

---

## Connection Management

### connectAndSubscribe

Connects to a BLE device and subscribes to heart rate notifications.

```typescript
connectAndSubscribe(
  deviceId: string,
  callbacks: BleCallbacks
): Promise<() => void>
```

**Parameters:**
- `deviceId` — Device identifier from scan
- `callbacks` — State and data callbacks

**Returns:**
- Promise resolving to disconnect function

**Behavior:**
- Establishes GATT connection
- Subscribes to Heart Rate Measurement (0x2A37)
- Triggers `onHeartRateUpdate` on each measurement
- Calls `onStateChange('connected')` when ready

---

### connectWithRetry

Connects to a device with exponential backoff retry logic.

```typescript
connectWithRetry(
  deviceId: string,
  callbacks: BleCallbacks,
  maxAttempts?: number
): Promise<() => void>
```

**Parameters:**
- `deviceId` — Device identifier
- `callbacks` — State and data callbacks
- `maxAttempts` — Maximum retry attempts (default: 3)

**Returns:**
- Promise resolving to disconnect function

**Retry Strategy:**
- Exponential backoff: 1s, 2s, 4s between attempts
- Automatically reconnects on connection loss
- Emits `onStateChange('reconnecting')` during retry

**Example:**
```typescript
const disconnect = await connectWithRetry(deviceId, {
  onHeartRateUpdate: (measurement) => {
    console.log(`HR: ${measurement.heartRate} bpm`);
  },
  onError: (err) => console.error(err),
}, 3);
```

---

## Data Parsing

### parseHeartRateMeasurement

Parses raw GATT 0x2A37 Heart Rate Measurement data.

```typescript
parseHeartRateMeasurement(data: Uint8Array): HeartRateMeasurement
```

**Parameters:**
- `data` — GATT characteristic value as Uint8Array

**Returns:**
- `HeartRateMeasurement` with parsed heart rate and R-R intervals

**GATT Format (Bluetooth SIG 0x2A37):**
- Flags byte (bit 0: HR format; bit 2: RR intervals present)
- Heart rate value (1–2 bytes depending on flags)
- Optional: Energy expended and R-R intervals

**Example:**
```typescript
const raw = new Uint8Array([0x14, 0x72, 0x18, 0x03, 0x20, 0x03]);
const measurement = parseHeartRateMeasurement(raw);
// { heartRate: 72, rrIntervals: [792, 800] }
```

---

### isValidRrInterval

Validates an R-R interval is within physiological range.

```typescript
isValidRrInterval(rrMs: number): boolean
```

**Parameters:**
- `rrMs` — R-R interval in milliseconds

**Returns:**
- `true` if interval is 300–2500ms (corresponds to 24–200 bpm)

---

## Utilities

### isBleAvailable

Checks if device supports Bluetooth Low Energy.

```typescript
isBleAvailable(): Promise<boolean>
```

**Returns:**
- Promise resolving to `true` if BLE hardware available

---

### requestBlePermissions

Requests Bluetooth runtime permissions (iOS/Android).

```typescript
requestBlePermissions(): Promise<PermissionStatus>
```

**Returns:**
- `'granted'` — User approved
- `'denied'` — User declined
- `'blocked'` — Permissions permanently blocked

**Platforms:**
- iOS 13+: Requests Bluetooth Peripheral permission
- Android 6+: Requests location + Bluetooth permissions

---

### showPermissionBlockedAlert

Displays a user-facing alert explaining BLE permissions are blocked.

```typescript
showPermissionBlockedAlert(): void
```

**Use when:** Permission status is `'blocked'` to guide user to Settings.

---

### base64ToUint8Array

Converts base64-encoded string to Uint8Array.

```typescript
base64ToUint8Array(base64: string): Uint8Array
```

**Parameters:**
- `base64` — Base64-encoded string (BLE data often arrives this way)

**Returns:**
- Decoded byte array

---

### destroyManager

Cleans up BLE resources and disconnects all active connections.

```typescript
destroyManager(): void
```

**Use when:** App closes or BLE is no longer needed.

---

## Recording Hook

### useBleRecording

React hook managing a complete recording session with auto-reconnect and timer.

```typescript
useBleRecording(): [RecordingState, RecordingActions]
```

**Returns:**
```typescript
[
  // State
  {
    isRecording: boolean;
    connectionState: BleConnectionState;
    elapsedSeconds: number;
    heartRateMeasurements: HeartRateMeasurement[];
    error: string | null;
  },
  
  // Actions
  {
    startRecording: (deviceId: string) => Promise<void>;
    stopRecording: () => Promise<void>;
    cancelRecording: () => Promise<void>;
    clearError: () => void;
  }
]
```

**Features:**
- Auto-reconnects on dropped connection
- 5-minute recording duration with optional early finish
- Accumulates all HR measurements in state
- Enforces minimum 2-minute recording window

**Example:**
```typescript
const [state, actions] = useBleRecording();

const handleStart = async () => {
  await actions.startRecording(deviceId);
};

const handleStop = async () => {
  await actions.stopRecording();
  console.log(`Recorded ${state.heartRateMeasurements.length} measurements`);
};

return (
  <>
    <Text>{state.elapsedSeconds}s</Text>
    <Button onPress={handleStart} disabled={state.isRecording}>
      Start
    </Button>
    <Button onPress={handleStop} disabled={!state.isRecording}>
      Stop
    </Button>
  </>
);
```

---

## Constants

**HR Service UUID:** `0x180D`  
**HR Measurement Characteristic:** `0x2A37`  
**Default Scan Timeout:** 10,000 ms  
**Default Max Retry Attempts:** 3  
**Valid RR Range:** 300–2,500 ms (24–200 bpm)  
**Default Recording Duration:** 300 seconds (5 minutes)  
**Minimum Recording Duration:** 120 seconds (2 minutes)
