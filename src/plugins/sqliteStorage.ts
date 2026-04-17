/**
 * SQLite-backed {@link PluginStorage} implementation.
 *
 * Persists installed plugins to the existing `settings` table under
 * keys of the form `plugin_installed:<id>`. Values are JSON-serialized
 * {@link InstalledPlugin} records.
 */
import { getDatabase } from '../database/database';
import { InstalledPlugin, PluginStorage } from './marketplace';

const KEY_PREFIX = 'plugin_installed:';

export class SqlitePluginStorage implements PluginStorage {
  async list(): Promise<InstalledPlugin[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key LIKE ?`,
      `${KEY_PREFIX}%`
    );
    const out: InstalledPlugin[] = [];
    for (const row of rows) {
      try {
        out.push(JSON.parse(row.value));
      } catch {
        // skip corrupt records
      }
    }
    return out;
  }

  async upsert(entry: InstalledPlugin): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      `${KEY_PREFIX}${entry.id}`,
      JSON.stringify(entry)
    );
  }

  async remove(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM settings WHERE key = ?`, `${KEY_PREFIX}${id}`);
  }
}
