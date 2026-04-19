/**
 * BLE device scanning hook.
 *
 * Manages the scan lifecycle: permission request, device discovery,
 * auto-connect to paired device, timeout handling, and rescan.
 * Extracted from ReadingScreen to reduce coupling and enable reuse
 * (e.g., in OrthostaticScreen or CoherenceScreen).
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Device } from 'react-native-ble-plx';
import { scanForDevices } from '../ble/bleManager';
import { requestBlePermissions, showPermissionBlockedAlert } from '../ble/permissions';
import { loadSettings } from '../database/settingsRepository';

const DEFAULT_SCAN_TIMEOUT_MS = 15_000;

export interface DeviceScannerState {
  /** Discovered BLE devices. */
  devices: Device[];
  /** Whether scan has timed out without finding devices. */
  scanTimedOut: boolean;
  /** Whether a paired device was found and auto-selected. */
  autoConnectedDeviceId: string | null;
  /** Whether breathing exercise is enabled in settings. */
  breathingEnabled: boolean;
  /** The user's paired device ID from settings, if any. */
  pairedDeviceId: string | null;
  /** Whether permissions were denied or blocked. */
  permissionDenied: boolean;
}

export interface DeviceScannerActions {
  /** Restart the BLE scan (clears device list). */
  restartScan: () => Promise<void>;
  /** Stop the current scan. */
  stopScan: () => void;
}

/**
 * Hook that manages BLE device scanning with auto-connect and timeout.
 *
 * On mount, loads settings, requests BLE permissions, and starts scanning.
 * If a paired device is found, it auto-selects it and stops the scan.
 */
export function useDeviceScanner(
  scanTimeoutMs: number = DEFAULT_SCAN_TIMEOUT_MS
): [DeviceScannerState, DeviceScannerActions] {
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanTimedOut, setScanTimedOut] = useState(false);
  const [autoConnectedDeviceId, setAutoConnectedDeviceId] = useState<string | null>(null);
  const [breathingEnabled, setBreathingEnabled] = useState(true);
  const [pairedDeviceId, setPairedDeviceId] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const stopScanRef = useRef<(() => void) | null>(null);
  const cancelledRef = useRef(false);

  const runScan = useCallback(
    async (pairedId: string | null) => {
      setDevices([]);
      setScanTimedOut(false);
      setAutoConnectedDeviceId(null);

      const permStatus = await requestBlePermissions();
      if (permStatus === 'blocked') {
        showPermissionBlockedAlert();
        setPermissionDenied(true);
        return;
      }
      if (permStatus === 'denied') {
        setPermissionDenied(true);
        return;
      }

      try {
        const stop = await scanForDevices((device) => {
          if (cancelledRef.current) return;

          if (pairedId && device.id === pairedId) {
            stop();
            setAutoConnectedDeviceId(device.id);
            return;
          }

          setDevices((prev) => {
            if (prev.find((d) => d.id === device.id)) return prev;
            return [...prev, device];
          });
        });

        stopScanRef.current = stop;

        setTimeout(() => {
          if (!cancelledRef.current) setScanTimedOut(true);
        }, scanTimeoutMs);
      } catch {
        // Scan may fail if BLE is off — swallowed, UI shows "no devices"
      }
    },
    [scanTimeoutMs]
  );

  // Initial scan on mount
  useEffect(() => {
    cancelledRef.current = false;

    const init = async () => {
      const settings = await loadSettings();
      if (cancelledRef.current) return;
      setBreathingEnabled(settings.breathingExerciseEnabled);
      setPairedDeviceId(settings.pairedDeviceId);
      await runScan(settings.pairedDeviceId);
    };
    init().catch(() => {});

    return () => {
      cancelledRef.current = true;
      stopScanRef.current?.();
    };
  }, [runScan]);

  const restartScan = useCallback(async () => {
    await runScan(pairedDeviceId);
  }, [runScan, pairedDeviceId]);

  const stopScan = useCallback(() => {
    stopScanRef.current?.();
  }, []);

  return [
    {
      devices,
      scanTimedOut,
      autoConnectedDeviceId,
      breathingEnabled,
      pairedDeviceId,
      permissionDenied,
    },
    { restartScan, stopScan },
  ];
}
