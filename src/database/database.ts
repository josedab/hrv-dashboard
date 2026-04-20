import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'hrv_readiness.db';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Returns the singleton SQLite database instance.
 * On first call, opens the database and runs migrations to create tables.
 * Subsequent calls return the cached instance.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  try {
    await runMigrations(db);
  } catch (error) {
    db = null;
    throw error;
  }
  return db;
}

const CURRENT_SCHEMA_VERSION = 4;

/**
 * Runs schema migrations: creates `sessions` and `settings` tables,
 * enables WAL journal mode, creates timestamp index, and manages
 * schema versioning for future upgrades.
 */
async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      timestamp TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      rr_intervals TEXT NOT NULL,
      rmssd REAL NOT NULL,
      sdnn REAL NOT NULL,
      mean_hr REAL NOT NULL,
      pnn50 REAL NOT NULL,
      artifact_rate REAL NOT NULL,
      verdict TEXT,
      perceived_readiness INTEGER,
      training_type TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_timestamp ON sessions(timestamp);
  `);

  // Run versioned migrations
  const versionRow = await database.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'schema_version'`
  );
  const currentVersion = versionRow ? parseInt(versionRow.value, 10) : 0;

  if (currentVersion < 2) {
    // v2: add sleep/stress/context fields for expanded logging
    const columns = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(sessions)`);
    const columnNames = new Set(columns.map((c) => c.name));

    if (!columnNames.has('sleep_hours')) {
      await database.execAsync(`
        ALTER TABLE sessions ADD COLUMN sleep_hours REAL;
        ALTER TABLE sessions ADD COLUMN sleep_quality INTEGER;
        ALTER TABLE sessions ADD COLUMN stress_level INTEGER;
      `);
    }
  }

  if (currentVersion < 3) {
    // v3: create profiles table (previously created lazily)
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        is_active INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  if (currentVersion < 4) {
    // v4: add session source column (chest_strap | camera) for baseline filtering
    const columns = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(sessions)`);
    const columnNames = new Set(columns.map((c) => c.name));
    if (!columnNames.has('source')) {
      await database.execAsync(
        `ALTER TABLE sessions ADD COLUMN source TEXT NOT NULL DEFAULT 'chest_strap'`
      );
    }
  }

  // Update schema version
  await database.runAsync(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', ?)`,
    String(CURRENT_SCHEMA_VERSION)
  );
}

/**
 * Closes the database connection and clears the singleton reference.
 * Safe to call even if the database was never opened.
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
