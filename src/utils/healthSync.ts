import { Platform } from 'react-native';
import { Session } from '../types';
import { getRawSetting, setRawSetting } from '../database/settingsRepository';
import { getHealthSdk } from '../integrations/healthSdk';

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

/**
 * Checks if the health SDK is installed and the platform supports it.
 */
export function isHealthSyncAvailable(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  return getHealthSdk() !== null;
}

/**
 * Requests health data write permissions from the platform health store.
 * Returns true if permissions were granted.
 */
export async function requestHealthPermissions(): Promise<boolean> {
  const health = getHealthSdk();
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

        health.initHealthKit(permissions, (err: Error | null) => {
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
  const health = getHealthSdk();
  if (!health) return false;

  try {
    const startDate = new Date(session.timestamp);
    const endDate = new Date(startDate.getTime() + session.durationSeconds * 1000);

    if (Platform.OS === 'ios') {
      // Write SDNN sample (HealthKit uses SDNN for HRV, not rMSSD)
      await new Promise<void>((resolve, reject) => {
        health.saveHeartRateVariabilitySample?.(
          {
            value: session.sdnn / 1000,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
          (err: Error | null) => (err ? reject(err) : resolve())
        );
      });

      // Write heart rate sample
      await new Promise<void>((resolve, reject) => {
        health.saveHeartRateSample?.(
          {
            value: session.meanHr,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
          (err: Error | null) => (err ? reject(err) : resolve())
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

  const stored = await getRawSetting('health_synced_ids');
  const syncedIds = new Set<string>(stored ? JSON.parse(stored) : []);
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
    await setRawSetting('health_synced_ids', JSON.stringify([...syncedIds]));
    await setRawSetting('health_last_sync', new Date().toISOString());
  }

  return newlySynced;
}

/**
 * Loads health sync settings from the database.
 */
export async function loadHealthSyncSettings(): Promise<HealthSyncSettings> {
  const [enabledRaw, lastSync, syncedIdsRaw] = await Promise.all([
    getRawSetting('health_enabled'),
    getRawSetting('health_last_sync'),
    getRawSetting('health_synced_ids'),
  ]);

  const syncedIds: string[] = syncedIdsRaw ? JSON.parse(syncedIdsRaw) : [];

  return {
    enabled: enabledRaw === 'true',
    lastSyncTimestamp: lastSync,
    syncedSessionCount: syncedIds.length,
  };
}

/**
 * Saves health sync enabled state.
 */
export async function setHealthSyncEnabled(enabled: boolean): Promise<void> {
  await setRawSetting('health_enabled', String(enabled));
}
