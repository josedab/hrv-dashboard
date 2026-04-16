import { Platform } from 'react-native';
import { Session } from '../types';
import { getDatabase } from '../database/database';

/**
 * Health sync service for Apple HealthKit and Android Health Connect.
 *
 * Architecture:
 *   This module provides a platform-aware integration layer. On iOS it targets
 *   HealthKit's HRV and heart rate sample types. On Android it targets Health
 *   Connect's HeartRateVariabilityRmssd and HeartRate record types.
 *
 *   The SDK bindings (react-native-health for iOS, react-native-health-connect
 *   for Android) must be installed separately. When the native modules are not
 *   available, all operations gracefully return false/0 and the UI shows a
 *   "not available" state instead of a toggle.
 */

export interface HealthSyncSettings {
  enabled: boolean;
  lastSyncTimestamp: string | null;
  syncedSessionCount: number;
}

let _healthModule: any = null;
let _moduleChecked = false;

/**
 * Attempts to load the platform-specific health module at runtime.
 * Returns the module if available, null if not installed.
 */
function getHealthModule(): any {
  if (_moduleChecked) return _healthModule;
  _moduleChecked = true;

  try {
    if (Platform.OS === 'ios') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      _healthModule = require('react-native-health');
    } else if (Platform.OS === 'android') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      _healthModule = require('react-native-health-connect');
    }
  } catch {
    _healthModule = null;
  }

  return _healthModule;
}

/**
 * Checks if the health SDK is installed and the platform supports it.
 */
export function isHealthSyncAvailable(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  return getHealthModule() !== null;
}

/**
 * Requests health data write permissions from the platform health store.
 * Returns true if permissions were granted.
 */
export async function requestHealthPermissions(): Promise<boolean> {
  const health = getHealthModule();
  if (!health) return false;

  try {
    if (Platform.OS === 'ios') {
      return new Promise<boolean>((resolve) => {
        const permissions = {
          permissions: {
            write: [
              health.Constants?.Permissions?.HeartRateVariabilitySDNN,
              health.Constants?.Permissions?.HeartRate,
            ].filter(Boolean),
          },
        };

        health.initHealthKit(permissions, (err: any) => {
          resolve(!err);
        });
      });
    }

    if (Platform.OS === 'android') {
      const granted = await health.requestPermission([
        { accessType: 'write', recordType: 'HeartRateVariabilityRmssd' },
        { accessType: 'write', recordType: 'HeartRate' },
      ]);
      return Array.isArray(granted) && granted.length > 0;
    }
  } catch (error) {
    console.error('[HealthSync] Permission request failed:', error);
  }

  return false;
}

/**
 * Writes a single session's HRV data to the platform health store.
 */
export async function syncSessionToHealth(session: Session): Promise<boolean> {
  const health = getHealthModule();
  if (!health) return false;

  try {
    const startDate = new Date(session.timestamp);
    const endDate = new Date(startDate.getTime() + session.durationSeconds * 1000);

    if (Platform.OS === 'ios') {
      // Write SDNN sample (HealthKit uses SDNN for HRV, not rMSSD)
      await new Promise<void>((resolve, reject) => {
        health.saveHeartRateVariabilitySample?.(
          { value: session.sdnn / 1000, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
          (err: any) => err ? reject(err) : resolve()
        );
      });

      // Write heart rate sample
      await new Promise<void>((resolve, reject) => {
        health.saveHeartRateSample?.(
          { value: session.meanHr, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
          (err: any) => err ? reject(err) : resolve()
        );
      });

      return true;
    }

    if (Platform.OS === 'android') {
      await health.insertRecords([
        {
          recordType: 'HeartRateVariabilityRmssd',
          heartRateVariabilityMillis: session.rmssd,
          time: startDate.toISOString(),
        },
        {
          recordType: 'HeartRate',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          samples: [{ time: startDate.toISOString(), beatsPerMinute: Math.round(session.meanHr) }],
        },
      ]);
      return true;
    }
  } catch (error) {
    console.error(`[HealthSync] Failed to sync session ${session.id}:`, error);
  }

  return false;
}

/**
 * Syncs all un-synced sessions to the health platform.
 * Returns the count of newly synced sessions.
 */
export async function syncAllPendingSessions(sessions: Session[]): Promise<number> {
  if (!isHealthSyncAvailable()) return 0;

  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'health_synced_ids'`
  );

  const syncedIds = new Set<string>(row?.value ? JSON.parse(row.value) : []);
  let newlySynced = 0;

  for (const session of sessions) {
    if (syncedIds.has(session.id)) continue;

    const success = await syncSessionToHealth(session);
    if (success) {
      syncedIds.add(session.id);
      newlySynced++;
    }
  }

  if (newlySynced > 0) {
    await db.runAsync(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      'health_synced_ids',
      JSON.stringify([...syncedIds])
    );
    await db.runAsync(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      'health_last_sync',
      new Date().toISOString()
    );
  }

  return newlySynced;
}

/**
 * Loads health sync settings from the database.
 */
export async function loadHealthSyncSettings(): Promise<HealthSyncSettings> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key LIKE 'health_%'`
  );

  const stored: Record<string, string> = {};
  for (const row of rows) {
    stored[row.key] = row.value;
  }

  const syncedIds: string[] = stored.health_synced_ids
    ? JSON.parse(stored.health_synced_ids)
    : [];

  return {
    enabled: stored.health_enabled === 'true',
    lastSyncTimestamp: stored.health_last_sync ?? null,
    syncedSessionCount: syncedIds.length,
  };
}

/**
 * Saves health sync enabled state.
 */
export async function setHealthSyncEnabled(enabled: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
    'health_enabled',
    String(enabled)
  );
}
