/**
 * Cross-platform BLE permission handling.
 *
 * Abstracts the permission differences between iOS (system dialog via
 * Info.plist) and Android (runtime permissions that vary by API level).
 * Returns a unified {@link PermissionStatus} for callers.
 */
import { Platform, Alert, Linking } from 'react-native';
import { PermissionsAndroid } from 'react-native';

/** BLE permission status returned by {@link requestBlePermissions}. */
export type PermissionStatus = 'granted' | 'denied' | 'blocked';

/**
 * Requests the necessary BLE permissions for the current platform.
 * - iOS: Bluetooth permission is handled by the system dialog automatically
 *   when BLE scanning starts (configured via Info.plist). We just return granted.
 * - Android 12+ (API 31+): BLUETOOTH_SCAN, BLUETOOTH_CONNECT
 * - Android 10-11 (API 29-30): ACCESS_FINE_LOCATION
 * - Android <10: ACCESS_COARSE_LOCATION
 */
export async function requestBlePermissions(): Promise<PermissionStatus> {
  if (Platform.OS === 'ios') {
    // iOS handles BLE permissions via system dialog triggered by BleManager
    // The Info.plist already has NSBluetoothAlwaysUsageDescription
    return 'granted';
  }

  if (Platform.OS === 'android') {
    const apiLevel = Platform.Version;

    if (typeof apiLevel === 'number' && apiLevel >= 31) {
      // Android 12+
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);

      const scanGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === 'granted';
      const connectGranted =
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === 'granted';

      if (scanGranted && connectGranted) return 'granted';

      const neverAskAgain =
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === 'never_ask_again' ||
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === 'never_ask_again';

      return neverAskAgain ? 'blocked' : 'denied';
    } else {
      // Android 10-11
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission Required',
          message:
            'HRV Readiness needs location permission to scan for nearby Bluetooth heart rate monitors. Your location data is never stored or shared.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );

      if (result === 'granted') return 'granted';
      return result === 'never_ask_again' ? 'blocked' : 'denied';
    }
  }

  return 'granted';
}

/**
 * Shows an alert directing the user to app settings when permissions are blocked.
 */
export function showPermissionBlockedAlert(): void {
  Alert.alert(
    'Bluetooth Permission Required',
    'HRV Readiness needs Bluetooth access to connect to your heart rate monitor. Please enable it in Settings.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => Linking.openSettings(),
      },
    ]
  );
}
