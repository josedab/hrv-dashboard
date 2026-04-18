import { Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { getAllSessions, upsertManySessionsIfMissing } from '../database/sessionRepository';
import { getSettingsRecord, upsertManyRaw } from '../database/settingsRepository';
import { Session } from '../types';
import { arrayToHex, hexToArray, getRandomBytes, hmacSha256, constantTimeEqual } from './encoding';
import { aesGcmEncrypt, aesGcmDecrypt } from '../sync/aesGcm';
import { scryptDeriveKey, SCRYPT_SALT_LENGTH } from '../sync/scryptKdf';

/**
 * Backup file format version.
 *   v1 — encrypt-then-hash plaintext (legacy, still readable for restore).
 *   v2 — encrypt-then-MAC: HMAC-SHA-256 over (iv || ciphertext) with a
 *        domain-separated MAC key derived from the same passphrase.
 *   v3 — AES-256-GCM with an iterated-SHA-256 KDF (legacy, still readable).
 *   v4 — **AES-256-GCM with a scrypt KDF** (N=2^14, r=8, p=1). The
 *        memory-hard KDF makes offline brute-force against a leaked
 *        backup file ~10⁴–10⁵× more expensive per guess than under v3,
 *        which matters because backups can sit on cloud drives indefinitely.
 *        v1–v3 files still restore for backwards compat.
 */
const BACKUP_VERSION = 4;
/** Older versions this codebase can still read. */
const MIN_SUPPORTED_VERSION = 1;
const SALT_LENGTH = SCRYPT_SALT_LENGTH;
const IV_LENGTH = 12;
/** Domain-separation suffix appended to passphrase when deriving the MAC key. */
const MAC_KEY_DOMAIN = '\0mac';
/** AES-256 needs a 32-byte key; SHA-256-derived material is exactly that. */
const AES_KEY_LENGTH = 32;

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

/**
 * Legacy v1/v2 encrypt path. Kept only because `decryptData` (used by the
 * v1/v2 restore path below) uses the same XOR-with-SHA-256-keystream
 * construction; new backups always go through `aesGcmEncrypt`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  const settings = await getSettingsRecord({ includeInternal: false });

  const payload: BackupPayload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sessions,
    settings,
  };

  const json = JSON.stringify(payload);
  const salt = await getRandomBytes(SALT_LENGTH);
  const iv = await getRandomBytes(IV_LENGTH);
  // v4: scrypt KDF. The salt is bound into the scrypt input so reusing the
  // same passphrase across backups still yields independent keys.
  const aesKey = await scryptDeriveKey(passphrase, salt, 'hrv-backup');
  const ciphertext = aesGcmEncrypt(aesKey, iv, new TextEncoder().encode(json));

  // Package: version + salt + iv + ciphertext (with embedded GCM tag).
  // No separate `mac` — GCM authenticates the ciphertext itself.
  const backupFile = JSON.stringify({
    v: BACKUP_VERSION,
    salt: arrayToHex(salt),
    iv: arrayToHex(iv),
    data: arrayToHex(ciphertext),
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

  let backupFile: {
    v: number;
    salt: string;
    iv: string;
    /** v1 only: SHA-256 of plaintext JSON (legacy, forgeable). */
    integrity?: string;
    /** v2+: HMAC-SHA-256 over (iv || ciphertext) with a domain-separated MAC key. */
    mac?: string;
    data: string;
  };
  try {
    backupFile = JSON.parse(raw);
  } catch {
    throw new Error('Invalid backup file format');
  }

  if (!backupFile.v || !backupFile.salt || !backupFile.iv || !backupFile.data) {
    throw new Error('Corrupt or incompatible backup file');
  }

  // Reject non-numeric / non-integer `v` before branching. JS coercion
  // would otherwise let strings like "4" pass the range check and land
  // in the wrong restore branch, mirroring the dispatch hardening on the
  // sync/share envelopes.
  if (typeof backupFile.v !== 'number' || !Number.isInteger(backupFile.v)) {
    throw new Error('Corrupt backup file: version field must be an integer');
  }

  if (backupFile.v < MIN_SUPPORTED_VERSION || backupFile.v > BACKUP_VERSION) {
    throw new Error(
      `Backup version v${backupFile.v} is not supported by this app version. ` +
        `Supported range: v${MIN_SUPPORTED_VERSION}–v${BACKUP_VERSION}.`
    );
  }

  const salt = hexToArray(backupFile.salt);
  const iv = hexToArray(backupFile.iv);

  let json: string;

  if (backupFile.v >= 4) {
    // v4: scrypt KDF + AES-GCM. Authenticated; tag is part of `data`.
    const aesKey = await scryptDeriveKey(passphrase, salt, 'hrv-backup');
    try {
      const pt = aesGcmDecrypt(aesKey, iv, hexToArray(backupFile.data));
      json = new TextDecoder().decode(pt);
    } catch {
      throw new Error('Authentication failed — wrong passphrase or tampered file');
    }
  } else if (backupFile.v === 3) {
    // v3: iterated-SHA-256 KDF + AES-GCM. Authenticated; tag is part of `data`.
    const encKey = await deriveKey(passphrase, salt);
    const aesKey = encKey.length === AES_KEY_LENGTH ? encKey : encKey.slice(0, AES_KEY_LENGTH);
    try {
      const pt = aesGcmDecrypt(aesKey, iv, hexToArray(backupFile.data));
      json = new TextDecoder().decode(pt);
    } catch {
      throw new Error('Authentication failed — wrong passphrase or tampered file');
    }
  } else {
    const encKey = await deriveKey(passphrase, salt);
    // v2: verify HMAC BEFORE decrypting (encrypt-then-MAC discipline).
    if (backupFile.v >= 2) {
      if (!backupFile.mac) {
        throw new Error('Corrupt backup: v2 file missing MAC');
      }
      const macKey = await deriveKey(passphrase + MAC_KEY_DOMAIN, salt);
      const ciphertextBytes = hexToArray(backupFile.data);
      const macInput = new Uint8Array(iv.length + ciphertextBytes.length);
      macInput.set(iv);
      macInput.set(ciphertextBytes, iv.length);
      const expectedMac = await hmacSha256(macKey, macInput);
      const providedMac = hexToArray(backupFile.mac);
      if (!constantTimeEqual(expectedMac, providedMac)) {
        throw new Error('Authentication failed — wrong passphrase or tampered file');
      }
    }

    try {
      json = await decryptData(backupFile.data, encKey, iv);
    } catch {
      throw new Error('Decryption failed — wrong passphrase or corrupt file');
    }

    // v1 legacy: verify plaintext SHA-256. All historical v1 backups carry
    // `integrity`; a missing field on a v1 file is treated as tampering
    // (closes a downgrade attack where v2/v3 metadata is stripped to reach
    // this unauthenticated path).
    if (backupFile.v === 1) {
      if (!backupFile.integrity) {
        throw new Error('Corrupt backup: v1 file missing integrity hash');
      }
      const encoder = new TextEncoder();
      const hashResult = await Crypto.digest(
        Crypto.CryptoDigestAlgorithm.SHA256,
        encoder.encode(json)
      );
      const computedHash =
        typeof hashResult === 'string' ? hashResult : arrayToHex(new Uint8Array(hashResult));
      if (computedHash !== backupFile.integrity) {
        throw new Error('Integrity check failed — wrong passphrase');
      }
    }
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

  const imported = await upsertManySessionsIfMissing(payload.sessions);

  // Restore user-facing settings; INTERNAL_SETTINGS_KEYS are filtered out.
  await upsertManyRaw(payload.settings ?? {});

  return imported;
}
