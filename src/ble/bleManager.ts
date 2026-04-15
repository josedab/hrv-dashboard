import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { parseHeartRateMeasurement, base64ToUint8Array, HeartRateMeasurement } from './heartRateParser';

const HEART_RATE_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
const HEART_RATE_MEASUREMENT_UUID = '00002a37-0000-1000-8000-00805f9b34fb';
const POLAR_H10_NAME_PREFIX = 'Polar H10';
const SCAN_TIMEOUT_MS = 15000;

export type BleConnectionState = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'error';

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
 * Connects to a device and subscribes to Heart Rate Measurement notifications.
 * Returns a cleanup function to disconnect and unsubscribe.
 */
export async function connectAndSubscribe(
  deviceId: string,
  callbacks: BleCallbacks
): Promise<() => void> {
  const bleManager = getManager();
  let subscription: Subscription | null = null;
  let connectedDevice: Device | null = null;

  try {
    callbacks.onStateChange('connecting');

    connectedDevice = await bleManager.connectToDevice(deviceId, {
      requestMTU: 512,
    });

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

    // Monitor disconnection
    bleManager.onDeviceDisconnected(deviceId, () => {
      callbacks.onStateChange('disconnected');
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown BLE error';
    callbacks.onStateChange('error');
    callbacks.onError(message);
  }

  return () => {
    subscription?.remove();
    if (connectedDevice) {
      bleManager.cancelDeviceConnection(deviceId).catch(() => {});
    }
  };
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
