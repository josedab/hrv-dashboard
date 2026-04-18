import { Settings, DEFAULT_SETTINGS, parseVerdictMode } from '../types';
import { getDatabase } from './database';

/** Allowed range for `baselineWindowDays` (matches Settings UI choices). */
const BASELINE_WINDOW_MIN = 5;
const BASELINE_WINDOW_MAX = 14;

function coerceInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined) return fallback;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    if (raw !== '') {
      console.warn(
        `[settingsRepository] Invalid int value '${raw}' (range ${min}–${max}); using default ${fallback}`
      );
    }
    return fallback;
  }
  return parsed;
}

function coerceFloat(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined) return fallback;
  const parsed = parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    if (raw !== '') {
      console.warn(
        `[settingsRepository] Invalid float value '${raw}' (range ${min}–${max}); using default ${fallback}`
      );
    }
    return fallback;
  }
  return parsed;
}

function coerceBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}

/**
 * Loads all settings from the database, validating each value and falling
 * back to {@link DEFAULT_SETTINGS} on missing, malformed, or out-of-range
 * entries. Threshold pairs are additionally checked for logical consistency
 * via {@link validateThresholds}; both fall back together if invalid.
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

  const baselineWindowDays = coerceInt(
    stored.baselineWindowDays,
    DEFAULT_SETTINGS.baselineWindowDays,
    BASELINE_WINDOW_MIN,
    BASELINE_WINDOW_MAX
  );

  let goHardThreshold = coerceFloat(stored.goHardThreshold, DEFAULT_SETTINGS.goHardThreshold, 0, 1);
  let moderateThreshold = coerceFloat(
    stored.moderateThreshold,
    DEFAULT_SETTINGS.moderateThreshold,
    0,
    1
  );
  if (validateThresholds(goHardThreshold, moderateThreshold) !== null) {
    console.warn('[settingsRepository] Stored thresholds inconsistent; resetting to defaults');
    goHardThreshold = DEFAULT_SETTINGS.goHardThreshold;
    moderateThreshold = DEFAULT_SETTINGS.moderateThreshold;
  }

  return {
    baselineWindowDays,
    goHardThreshold,
    moderateThreshold,
    pairedDeviceId: stored.pairedDeviceId ?? DEFAULT_SETTINGS.pairedDeviceId,
    pairedDeviceName: stored.pairedDeviceName ?? DEFAULT_SETTINGS.pairedDeviceName,
    breathingExerciseEnabled: coerceBool(
      stored.breathingExerciseEnabled,
      DEFAULT_SETTINGS.breathingExerciseEnabled
    ),
    verdictMode: parseVerdictMode(stored.verdictMode),
  };
}

/**
 * Saves a single setting.
 */
export async function saveSetting(key: keyof Settings, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, key, value);
}

/**
 * Validates that threshold settings are logically consistent.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateThresholds(goHard: number, moderate: number): string | null {
  if (goHard <= 0 || goHard > 1) return 'Go Hard threshold must be between 0 and 100%';
  if (moderate <= 0 || moderate > 1) return 'Moderate threshold must be between 0 and 100%';
  if (moderate >= goHard) return 'Moderate threshold must be lower than Go Hard threshold';
  return null;
}

/**
 * Saves multiple settings at once within a transaction.
 */
export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const db = await getDatabase();
  const entries = Object.entries(settings).filter(([, v]) => v !== undefined);

  await db.withTransactionAsync(async () => {
    for (const [key, value] of entries) {
      await db.runAsync(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
        key,
        String(value ?? '')
      );
    }
  });
}

/**
 * Clears the paired device from settings.
 */
export async function clearPairedDevice(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM settings WHERE key IN ('pairedDeviceId', 'pairedDeviceName')`);
}

/**
 * Settings keys that are managed by the app itself rather than the user;
 * excluded from backups and "user settings" enumerations.
 */
export const INTERNAL_SETTINGS_KEYS: ReadonlySet<string> = new Set([
  'schema_version',
  'onboarding_complete',
  'widget_data',
  'health_synced_ids',
  'health_last_sync',
]);

/**
 * Returns all settings as a key/value map.
 *
 * @param includeInternal when false (default), {@link INTERNAL_SETTINGS_KEYS}
 * are excluded — useful for export/backup so app-managed state isn't shipped
 * with the user's preferences.
 */
export async function getSettingsRecord(
  options: { includeInternal?: boolean } = {}
): Promise<Record<string, string>> {
  const { includeInternal = false } = options;
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key NOT LIKE 'schema_%'`
  );
  const out: Record<string, string> = {};
  for (const row of rows) {
    if (!includeInternal && INTERNAL_SETTINGS_KEYS.has(row.key)) continue;
    out[row.key] = row.value;
  }
  return out;
}

/**
 * Reads a single raw string-valued setting. Returns null if missing.
 *
 * Use for app-internal state that doesn't fit the typed {@link Settings}
 * interface (sync timestamps, sets serialised as JSON, etc.).
 */
export async function getRawSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = ?`,
    key
  );
  return row?.value ?? null;
}

/** Writes a single raw string-valued setting. */
export async function setRawSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, key, value);
}

/**
 * Replaces user-facing settings in a single transaction. Keys listed in
 * {@link INTERNAL_SETTINGS_KEYS} are silently dropped from `entries`.
 */
export async function upsertManyRaw(entries: Record<string, string>): Promise<void> {
  const db = await getDatabase();
  const filtered = Object.entries(entries).filter(([key]) => !INTERNAL_SETTINGS_KEYS.has(key));
  if (filtered.length === 0) return;
  await db.withTransactionAsync(async () => {
    for (const [key, value] of filtered) {
      await db.runAsync(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, key, value);
    }
  });
}

/** Returns true if the user has completed onboarding. */
export async function isOnboardingComplete(): Promise<boolean> {
  const value = await getRawSetting('onboarding_complete');
  return value === 'true';
}

/** Marks onboarding as complete. */
export async function setOnboardingComplete(): Promise<void> {
  await setRawSetting('onboarding_complete', 'true');
}
