import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'hrv_readiness.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await runMigrations(db);
  return db;
}

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
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
