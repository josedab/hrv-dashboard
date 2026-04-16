import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import {
  parseHeartRateMeasurement,
  base64ToUint8Array,
  HeartRateMeasurement,
} from './heartRateParser';

const HEART_RATE_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
const HEART_RATE_MEASUREMENT_UUID = '00002a37-0000-1000-8000-00805f9b34fb';
const POLAR_H10_NAME_PREFIX = 'Polar H10';
const SCAN_TIMEOUT_MS = 15000;
const CONNECTION_TIMEOUT_MS = 10000;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 1000;

export type BleConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface BleCallbacks {
  onStateChange: (state: BleConnectionState) => void;
  onHeartRateMeasurement: (measurement: HeartRateMeasurement) => void;
  onError: (error: string) => void;
}

let manager: BleManager | null = null;

function getManager(): BleManager {
  if (!manager) {
    manager = new BleManager();
  }
  return manager;
}

/**
 * Scans for Polar H10 devices advertising Heart Rate Service.
 */
export async function scanForDevices(
  onDeviceFound: (device: Device) => void,
  timeoutMs: number = SCAN_TIMEOUT_MS
): Promise<() => void> {
  const bleManager = getManager();

  return new Promise((resolve) => {
    const discoveredIds = new Set<string>();

    bleManager.startDeviceScan(
      [HEART_RATE_SERVICE_UUID],
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          console.warn('BLE scan error:', error.message);
          return;
        }
        if (device && device.id && !discoveredIds.has(device.id)) {
          discoveredIds.add(device.id);
          onDeviceFound(device);
        }
      }
    );

    const stopScan = () => {
      bleManager.stopDeviceScan();
    };

    // Auto-stop after timeout
    const timer = setTimeout(stopScan, timeoutMs);

    resolve(() => {
      clearTimeout(timer);
      stopScan();
    });
  });
}

/**
 * Connects to a device with a timeout.
 * Rejects if connection takes longer than CONNECTION_TIMEOUT_MS.
 */
async function connectWithTimeout(
  bleManager: BleManager,
  deviceId: string,
  timeoutMs: number = CONNECTION_TIMEOUT_MS
): Promise<Device> {
  return Promise.race([
    bleManager.connectToDevice(deviceId, { requestMTU: 512 }),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        bleManager.cancelDeviceConnection(deviceId).catch(() => {});
        reject(new Error(`Connection timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);
    }),
  ]);
}

/**
 * Connects to a device and subscribes to Heart Rate Measurement notifications.
 * Returns a cleanup function to disconnect and unsubscribe.
 * Errors are propagated (not caught internally) for retry logic.
 */
export async function connectAndSubscribe(
  deviceId: string,
  callbacks: BleCallbacks
): Promise<() => void> {
  const bleManager = getManager();
  let subscription: Subscription | null = null;

  callbacks.onStateChange('connecting');

  const connectedDevice = await connectWithTimeout(bleManager, deviceId);
  await connectedDevice.discoverAllServicesAndCharacteristics();
  callbacks.onStateChange('connected');

  subscription = connectedDevice.monitorCharacteristicForService(
    HEART_RATE_SERVICE_UUID,
    HEART_RATE_MEASUREMENT_UUID,
    (error, characteristic) => {
      if (error) {
        callbacks.onError(`Notification error: ${error.message}`);
        return;
      }
      if (characteristic?.value) {
        try {
          const data = base64ToUint8Array(characteristic.value);
          const measurement = parseHeartRateMeasurement(data);
          callbacks.onHeartRateMeasurement(measurement);
        } catch (parseError) {
          console.warn('Failed to parse HR measurement:', parseError);
        }
      }
    }
  );

  // Monitor disconnection — store subscription for cleanup
  const disconnectSub = bleManager.onDeviceDisconnected(deviceId, () => {
    callbacks.onStateChange('disconnected');
  });

  return () => {
    subscription?.remove();
    disconnectSub.remove();
    bleManager.cancelDeviceConnection(deviceId).catch(() => {});
  };
}

/**
 * Attempts to connect with exponential backoff retry.
 * Retries up to MAX_RECONNECT_ATTEMPTS times on failure.
 * Reports 'reconnecting' state between attempts.
 */
export async function connectWithRetry(
  deviceId: string,
  callbacks: BleCallbacks,
  maxAttempts: number = MAX_RECONNECT_ATTEMPTS
): Promise<() => void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await connectAndSubscribe(deviceId, callbacks);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts - 1) {
        const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt);
        callbacks.onStateChange('reconnecting');
        callbacks.onError(
          `Connection failed, retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${maxAttempts})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  callbacks.onStateChange('error');
  throw lastError ?? new Error('Failed to connect after retries');
}

/**
 * Checks if Bluetooth is powered on.
 */
export async function isBleAvailable(): Promise<boolean> {
  const bleManager = getManager();
  return new Promise((resolve) => {
    const sub = bleManager.onStateChange((state) => {
      if (state === 'PoweredOn') {
        sub.remove();
        resolve(true);
      } else if (state === 'PoweredOff' || state === 'Unsupported') {
        sub.remove();
        resolve(false);
      }
    }, true);
  });
}

/**
 * Checks if a specific device is a Polar H10 by name.
 */
export function isPolarH10(device: Device): boolean {
  return device.name?.startsWith(POLAR_H10_NAME_PREFIX) ?? false;
}

/**
 * Destroys the BLE manager instance.
 */
export function destroyManager(): void {
  if (manager) {
    manager.destroy();
    manager = null;
  }
}
