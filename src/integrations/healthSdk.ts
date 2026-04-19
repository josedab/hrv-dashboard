/**
 * Shared lazy-loading utility for optional platform health SDK modules.
 *
 * Both `react-native-health` (iOS) and `react-native-health-connect`
 * (Android) are optional dependencies loaded via `require()` at runtime.
 * This module centralizes the platform detection and caching so that
 * healthSync, healthSleep, and sleepStrain don't each maintain their own
 * module-level singletons.
 */
import { Platform } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK types vary by platform
let _healthModule: Record<string, any> | null = null;
let _checked = false;

/**
 * Returns the platform health SDK module, or null if not installed.
 * Result is cached after first call.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getHealthSdk(): Record<string, any> | null {
  if (_checked) return _healthModule;
  _checked = true;
  try {
    if (Platform.OS === 'ios') {
      _healthModule = require('react-native-health');
    } else if (Platform.OS === 'android') {
      _healthModule = require('react-native-health-connect');
    }
  } catch {
    _healthModule = null;
  }
  return _healthModule;
}

/** Test-only: reset the cached SDK lookup. */
export function _resetHealthSdkCache(): void {
  _healthModule = null;
  _checked = false;
}
