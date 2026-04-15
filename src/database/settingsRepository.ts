import { Settings, DEFAULT_SETTINGS } from '../types';
import { getDatabase } from './database';

/**
 * Loads all settings from the database, falling back to defaults.
 */
export async function loadSettings(): Promise<Settings> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings`
  );

  const stored: Record<string, string> = {};
  for (const row of rows) {
    stored[row.key] = row.value;
  }

  return {
    baselineWindowDays: stored.baselineWindowDays
      ? parseInt(stored.baselineWindowDays, 10)
      : DEFAULT_SETTINGS.baselineWindowDays,
    goHardThreshold: stored.goHardThreshold
      ? parseFloat(stored.goHardThreshold)
      : DEFAULT_SETTINGS.goHardThreshold,
    moderateThreshold: stored.moderateThreshold
      ? parseFloat(stored.moderateThreshold)
      : DEFAULT_SETTINGS.moderateThreshold,
    pairedDeviceId: stored.pairedDeviceId ?? DEFAULT_SETTINGS.pairedDeviceId,
    pairedDeviceName: stored.pairedDeviceName ?? DEFAULT_SETTINGS.pairedDeviceName,
  };
}

/**
 * Saves a single setting.
 */
export async function saveSetting(key: keyof Settings, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
    key,
    value
  );
}

/**
 * Saves multiple settings at once.
 */
export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const db = await getDatabase();
  const entries = Object.entries(settings).filter(([, v]) => v !== undefined);

  for (const [key, value] of entries) {
    await db.runAsync(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      key,
      String(value ?? '')
    );
  }
}

/**
 * Clears the paired device from settings.
 */
export async function clearPairedDevice(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM settings WHERE key IN ('pairedDeviceId', 'pairedDeviceName')`);
}
