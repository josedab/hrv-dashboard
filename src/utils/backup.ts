import { Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { getAllSessions } from '../database/sessionRepository';
import { getDatabase } from '../database/database';
import { Session } from '../types';

const BACKUP_VERSION = 1;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

interface BackupPayload {
  version: number;
  exportedAt: string;
  sessions: Session[];
  settings: Record<string, string>;
}

/**
 * Derives an encryption key from a passphrase using PBKDF2-like hashing.
 * Uses multiple rounds of SHA-256 with a salt for key stretching.
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  let keyMaterial = encoder.encode(passphrase + arrayToHex(salt));

  // Key stretching: iterate SHA-256
  for (let i = 0; i < 1000; i++) {
    const hashResult = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, keyMaterial);
    const hashHex =
      typeof hashResult === 'string' ? hashResult : arrayToHex(new Uint8Array(hashResult));
    keyMaterial = new Uint8Array(
      hashHex.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
    );
  }
  return keyMaterial;
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function arrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToArray(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) return new Uint8Array(0);
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

/**
 * Encrypts data using a derived key via XOR stream cipher with SHA-256 keystream.
 * This provides real encryption (not the trivial XOR from before).
 * Each block uses SHA-256(key || counter) as the keystream.
 */
async function encryptData(data: string, key: Uint8Array, iv: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(data);
  const ciphertext = new Uint8Array(plaintext.length);

  // Generate keystream blocks using SHA-256(key || iv || counter)
  const blockSize = 32; // SHA-256 output
  for (let offset = 0; offset < plaintext.length; offset += blockSize) {
    const counter = new Uint8Array(4);
    const blockNum = Math.floor(offset / blockSize);
    counter[0] = (blockNum >> 24) & 0xff;
    counter[1] = (blockNum >> 16) & 0xff;
    counter[2] = (blockNum >> 8) & 0xff;
    counter[3] = blockNum & 0xff;

    const input = new Uint8Array([...key, ...iv, ...counter]);
    const hashResult = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, input);
    const keystream =
      typeof hashResult === 'string' ? hexToArray(hashResult) : new Uint8Array(hashResult);

    const end = Math.min(offset + blockSize, plaintext.length);
    for (let i = offset; i < end; i++) {
      ciphertext[i] = plaintext[i] ^ keystream[i - offset];
    }
  }

  return arrayToHex(ciphertext);
}

/**
 * Decrypts data encrypted with encryptData.
 * Stream cipher is symmetric — same operation for encrypt and decrypt.
 */
async function decryptData(
  ciphertextHex: string,
  key: Uint8Array,
  iv: Uint8Array
): Promise<string> {
  const ciphertext = hexToArray(ciphertextHex);
  const plaintext = new Uint8Array(ciphertext.length);

  const blockSize = 32;
  for (let offset = 0; offset < ciphertext.length; offset += blockSize) {
    const counter = new Uint8Array(4);
    const blockNum = Math.floor(offset / blockSize);
    counter[0] = (blockNum >> 24) & 0xff;
    counter[1] = (blockNum >> 16) & 0xff;
    counter[2] = (blockNum >> 8) & 0xff;
    counter[3] = blockNum & 0xff;

    const input = new Uint8Array([...key, ...iv, ...counter]);
    const hashResult = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, input);
    const keystream =
      typeof hashResult === 'string' ? hexToArray(hashResult) : new Uint8Array(hashResult);

    const end = Math.min(offset + blockSize, ciphertext.length);
    for (let i = offset; i < end; i++) {
      plaintext[i] = ciphertext[i] ^ keystream[i - offset];
    }
  }

  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

/**
 * Creates an encrypted backup and shares it as a file.
 * Uses SHA-256 CTR mode stream cipher with PBKDF2-like key derivation.
 */
export async function createBackup(passphrase: string): Promise<void> {
  if (!passphrase || passphrase.length < 4) {
    throw new Error('Passphrase must be at least 4 characters');
  }

  const sessions = await getAllSessions();
  const db = await getDatabase();
  const settingsRows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key NOT LIKE 'schema_%'`
  );

  const settings: Record<string, string> = {};
  for (const row of settingsRows) {
    settings[row.key] = row.value;
  }

  const payload: BackupPayload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sessions,
    settings,
  };

  const json = JSON.stringify(payload);
  const salt = getRandomBytes(SALT_LENGTH);
  const iv = getRandomBytes(IV_LENGTH);
  const key = await deriveKey(passphrase, salt);
  const encrypted = await encryptData(json, key, iv);

  // Compute integrity hash: SHA-256 of the plaintext JSON
  const encoder = new TextEncoder();
  const hashResult = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, encoder.encode(json));
  const integrityHash =
    typeof hashResult === 'string' ? hashResult : arrayToHex(new Uint8Array(hashResult));

  // Package: version + salt + iv + integrity hash + ciphertext
  const backupFile = JSON.stringify({
    v: BACKUP_VERSION,
    salt: arrayToHex(salt),
    iv: arrayToHex(iv),
    integrity: integrityHash,
    data: encrypted,
  });

  const filePath = `${Paths.cache}hrv-backup-${Date.now()}.hrvbak`;
  await FileSystem.writeAsStringAsync(filePath, backupFile);

  await Share.share({
    url: filePath,
    title: 'HRV Readiness Backup',
    message: `HRV Readiness encrypted backup (${sessions.length} sessions)`,
  });
}

/**
 * Restores sessions from an encrypted backup file.
 * Validates integrity after decryption to detect wrong passphrases.
 * Returns the number of new sessions imported.
 */
export async function restoreBackup(fileUri: string, passphrase: string): Promise<number> {
  if (!passphrase) {
    throw new Error('Passphrase is required');
  }

  const raw = await FileSystem.readAsStringAsync(fileUri);

  let backupFile: { v: number; salt: string; iv: string; integrity: string; data: string };
  try {
    backupFile = JSON.parse(raw);
  } catch {
    throw new Error('Invalid backup file format');
  }

  if (!backupFile.v || !backupFile.salt || !backupFile.iv || !backupFile.data) {
    throw new Error('Corrupt or incompatible backup file');
  }

  if (backupFile.v > BACKUP_VERSION) {
    throw new Error(
      `Backup was created with a newer version (v${backupFile.v}). ` +
        `Please update the app to restore this backup.`
    );
  }

  const salt = hexToArray(backupFile.salt);
  const iv = hexToArray(backupFile.iv);
  const key = await deriveKey(passphrase, salt);

  let json: string;
  try {
    json = await decryptData(backupFile.data, key, iv);
  } catch {
    throw new Error('Decryption failed — wrong passphrase or corrupt file');
  }

  // Verify integrity
  const encoder = new TextEncoder();
  const hashResult = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, encoder.encode(json));
  const computedHash =
    typeof hashResult === 'string' ? hashResult : arrayToHex(new Uint8Array(hashResult));

  if (backupFile.integrity && computedHash !== backupFile.integrity) {
    throw new Error('Integrity check failed — wrong passphrase');
  }

  let payload: BackupPayload;
  try {
    payload = JSON.parse(json);
  } catch {
    throw new Error('Decryption produced invalid data — wrong passphrase');
  }

  if (!payload.version || !Array.isArray(payload.sessions)) {
    throw new Error('Invalid backup payload structure');
  }

  const db = await getDatabase();
  let imported = 0;

  await db.withTransactionAsync(async () => {
    for (const session of payload.sessions) {
      if (!session.id || !session.timestamp) continue;

      const existing = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM sessions WHERE id = ?`,
        session.id
      );

      if (!existing) {
        await db.runAsync(
          `INSERT INTO sessions (id, timestamp, duration_seconds, rr_intervals, rmssd, sdnn, mean_hr, pnn50, artifact_rate, verdict, perceived_readiness, training_type, notes, sleep_hours, sleep_quality, stress_level)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          session.id,
          session.timestamp,
          session.durationSeconds ?? 0,
          JSON.stringify(session.rrIntervals ?? []),
          session.rmssd ?? 0,
          session.sdnn ?? 0,
          session.meanHr ?? 0,
          session.pnn50 ?? 0,
          session.artifactRate ?? 0,
          session.verdict ?? null,
          session.perceivedReadiness ?? null,
          session.trainingType ?? null,
          session.notes ?? null,
          session.sleepHours ?? null,
          session.sleepQuality ?? null,
          session.stressLevel ?? null
        );
        imported++;
      }
    }

    // Restore user settings, skipping internal state keys
    const internalKeys = new Set([
      'schema_version',
      'onboarding_complete',
      'widget_data',
      'health_synced_ids',
    ]);
    for (const [key, value] of Object.entries(payload.settings ?? {})) {
      if (internalKeys.has(key)) continue;
      await db.runAsync(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, key, value);
    }
  });

  return imported;
}
