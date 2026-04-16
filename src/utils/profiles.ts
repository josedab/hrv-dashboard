import { Share } from 'react-native';
import { getDatabase } from '../database/database';
import { Session } from '../types';
import { generateId } from './uuid';

export interface AthleteProfile {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * Creates the profiles table if it doesn't exist.
 * @deprecated Table is now created via database migration (v3).
 * Retained for backward compatibility; safe to call but no-ops
 * when the migration has already run.
 */
export async function ensureProfilesTable(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Gets all athlete profiles.
 */
export async function getProfiles(): Promise<AthleteProfile[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    is_active: number;
    created_at: string;
  }>(`SELECT * FROM profiles ORDER BY name ASC`);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    isActive: r.is_active === 1,
    createdAt: r.created_at,
  }));
}

/**
 * Creates a new athlete profile.
 */
export async function createProfile(name: string): Promise<AthleteProfile> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) {
    throw new Error('Profile name must be 1-100 characters');
  }

  const db = await getDatabase();
  const id = generateId();

  await db.runAsync(`INSERT INTO profiles (id, name) VALUES (?, ?)`, id, trimmed);

  return { id, name: trimmed, isActive: false, createdAt: new Date().toISOString() };
}

/**
 * Sets the active profile. Deactivates all others.
 */
export async function setActiveProfile(profileId: string): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE profiles SET is_active = 0`);
    await db.runAsync(`UPDATE profiles SET is_active = 1 WHERE id = ?`, profileId);
  });
}

/**
 * Deletes a profile (but does not delete its sessions).
 */
export async function deleteProfile(profileId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM profiles WHERE id = ?`, profileId);
}

/**
 * Shares today's verdict as a formatted text message.
 */
export async function shareVerdict(session: Session): Promise<void> {
  const verdictEmoji =
    session.verdict === 'go_hard'
      ? '🟢'
      : session.verdict === 'moderate'
        ? '🟡'
        : session.verdict === 'rest'
          ? '🔴'
          : '⚪';
  const verdictLabel =
    session.verdict === 'go_hard'
      ? 'Go Hard'
      : session.verdict === 'moderate'
        ? 'Moderate'
        : session.verdict === 'rest'
          ? 'Rest'
          : 'Building Baseline';

  const date = new Date(session.timestamp).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const message = [
    `${verdictEmoji} HRV Readiness — ${date}`,
    ``,
    `Verdict: ${verdictLabel}`,
    `rMSSD: ${session.rmssd.toFixed(1)} ms`,
    `Mean HR: ${session.meanHr.toFixed(0)} bpm`,
    `SDNN: ${session.sdnn.toFixed(1)} ms`,
    session.perceivedReadiness ? `Perceived readiness: ${session.perceivedReadiness}/5` : '',
    session.trainingType ? `Training: ${session.trainingType}` : '',
    ``,
    `— HRV Readiness Dashboard`,
  ]
    .filter(Boolean)
    .join('\n');

  await Share.share({ message, title: `HRV Readiness — ${date}` });
}
