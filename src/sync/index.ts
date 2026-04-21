/**
 * End-to-end encrypted cloud sync.
 *
 * Treats each session as an independently encrypted blob keyed by
 * deterministic id, so providers (iCloud Drive, Google Drive, etc.) only
 * ever see opaque ciphertext. The encryption layer reuses the proven
 * SHA-256 CTR + PBKDF2-like KDF from {@link ../utils/backup} via
 * {@link encryptString}.
 *
 * Conflict resolution: per-session "last writer wins" by `updatedAt` —
 * watch and phone both stamp records on save, so the most recent edit
 * is preserved without coordination.
 */
import { Session } from '../types';
import { encryptString, decryptString } from './crypto';
import { getErrorMessage } from '../utils/errors';

/**
 * Bump 2 → 3: switched the underlying cipher from SHA-256 CTR-XOR + HMAC
 * to real AES-256-GCM. v1 (unauthenticated) and v2 (HMAC) blobs still
 * decrypt; the next sync round will re-encrypt them as v3.
 */
export const SYNC_PROTOCOL_VERSION = 4;

/** Ciphertext envelope for a single session, what providers store. */
export interface EncryptedSessionBlob {
  /**
   * Format version of *this blob*. May be lower than
   * {@link SYNC_PROTOCOL_VERSION} for legacy data still in the cloud.
   */
  protocolVersion: number;
  sessionId: string;
  /** Wall-clock of the most recent local write — used by conflict resolution. */
  updatedAt: string;
  /** Hex-encoded random IV (12 bytes for v3 GCM, also 12 bytes for v2 CTR). */
  iv: string;
  /**
   * Hex-encoded ciphertext. For v3 the trailing 16 bytes are the GCM
   * authentication tag.
   */
  ciphertext: string;
  /**
   * Hex HMAC-SHA-256 over (iv || ciphertext). Present on v2 blobs only —
   * v3/v4 carry their tag inside `ciphertext` and v1 had no integrity check.
   */
  mac?: string;
  /**
   * v4 only: hex per-blob random salt for the scrypt KDF. Absent on v1–v3.
   */
  salt?: string;
}

/** Pluggable provider that the app uploads/downloads encrypted blobs to. */
export interface SyncProvider {
  /** Provider id, e.g. "icloud-drive" or "google-drive". */
  id: string;
  /** Lists all session blob ids currently in the remote store. */
  list(): Promise<string[]>;
  /** Reads a single blob by session id, or null if missing. */
  get(sessionId: string): Promise<EncryptedSessionBlob | null>;
  /** Writes a blob, overwriting any existing copy. */
  put(blob: EncryptedSessionBlob): Promise<void>;
  /** Deletes a blob; idempotent. */
  remove(sessionId: string): Promise<void>;
}

/** Result of a full sync round-trip. */
export interface SyncResult {
  uploaded: number;
  downloaded: number;
  conflictsResolved: number;
  skipped: number;
  errors: { sessionId: string; message: string }[];
}

/**
 * Encrypts a session for upload. Each session gets a fresh random IV.
 * A *deterministic* salt derived from the user passphrase is intentionally
 * NOT used because the high-level app stores its own salt; here we
 * combine the passphrase with the sessionId so the key varies per blob,
 * preventing keystream reuse across sessions if an IV ever collided.
 *
 * For v3 we additionally bind `updatedAt` *inside* the encrypted payload
 * so that conflict resolution can't be skewed by tampering with the
 * envelope (a compromised storage provider rewriting `updated_at` to a
 * future timestamp would otherwise force stale ciphertext to win).
 */
export async function encryptSessionBlob(
  session: Session,
  passphrase: string,
  updatedAt: string
): Promise<EncryptedSessionBlob> {
  const wrapped: SyncPayloadV3 = { __updatedAt: updatedAt, session };
  const json = JSON.stringify(wrapped);
  const { ciphertext, iv, mac, version, salt } = await encryptString(json, passphrase, session.id);
  return {
    protocolVersion: version ?? SYNC_PROTOCOL_VERSION,
    sessionId: session.id,
    updatedAt,
    iv,
    ciphertext,
    // v3 leaves mac empty; only v2 needs the field on the wire.
    ...(mac ? { mac } : {}),
    ...(salt ? { salt } : {}),
  };
}

/**
 * v3 wire payload: a Session wrapped with its `updatedAt` watermark so
 * the conflict-resolution timestamp is part of the AEAD-protected blob.
 */
interface SyncPayloadV3 {
  __updatedAt: string;
  session: Session;
}

/** Decrypts a session blob; throws on wrong passphrase or corrupt data. */
export async function decryptSessionBlob(
  blob: EncryptedSessionBlob,
  passphrase: string
): Promise<Session> {
  if (typeof blob.protocolVersion !== 'number' || !Number.isFinite(blob.protocolVersion)) {
    throw new Error('Sync blob is missing or has invalid protocolVersion');
  }
  if (blob.protocolVersion > SYNC_PROTOCOL_VERSION) {
    throw new Error(
      `Sync protocol v${blob.protocolVersion} is newer than this client (v${SYNC_PROTOCOL_VERSION}); please update the app`
    );
  }
  // Salt only belongs on v4. Reject mismatches to prevent a stripped/forged
  // envelope from being accepted on a legacy code path.
  if (blob.protocolVersion === 4 && !blob.salt) {
    throw new Error('Sync v4 blob is missing required salt');
  }
  if (blob.protocolVersion !== 4 && blob.salt) {
    throw new Error(`Sync v${blob.protocolVersion} blob must not carry a salt field`);
  }
  const plaintext = await decryptString(
    blob.ciphertext,
    passphrase,
    blob.sessionId,
    blob.iv,
    blob.mac,
    blob.protocolVersion,
    blob.salt
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error('Decryption produced invalid JSON — wrong passphrase or corrupt blob');
  }
  // v3: wrapped {__updatedAt, session} — verify the envelope's
  // updatedAt matches the AEAD-protected one, then unwrap.
  if (
    blob.protocolVersion >= 3 &&
    parsed &&
    typeof parsed === 'object' &&
    '__updatedAt' in parsed &&
    'session' in parsed
  ) {
    const wrapped = parsed as SyncPayloadV3;
    if (wrapped.__updatedAt !== blob.updatedAt) {
      throw new Error('Sync blob envelope has been tampered with');
    }
    parsed = wrapped.session;
  }
  if (!parsed || typeof parsed !== 'object' || !(parsed as Session).id) {
    throw new Error('Decrypted payload is not a Session');
  }
  return parsed as Session;
}

/**
 * Returns the locally-resident session if it should win the conflict, otherwise null.
 * Last-write-wins by `updatedAt`. Ties resolve to the local copy to avoid flapping.
 */
export function resolveConflict(
  local: { session: Session; updatedAt: string },
  remote: { blob: EncryptedSessionBlob }
): 'local' | 'remote' {
  return remote.blob.updatedAt > local.updatedAt ? 'remote' : 'local';
}

export interface SyncEngineOptions {
  passphrase: string;
  /** Loads all local sessions plus their per-session updatedAt watermark. */
  loadLocal: () => Promise<{ session: Session; updatedAt: string }[]>;
  /** Persists a session arrived from the cloud (insert-or-replace). */
  upsertLocal: (session: Session, updatedAt: string) => Promise<void>;
  /** Removes a session from local storage by id. Used for tombstone propagation. */
  removeLocal?: (sessionId: string) => Promise<void>;
  provider: SyncProvider;
}

/**
 * Runs a full bidirectional sync. Algorithm:
 *   1. List remote ids and load local ids
 *   2. Upload sessions present locally but absent remotely
 *   3. Download sessions present remotely but absent locally
 *   4. For overlap: compare `updatedAt`; replace the loser
 */
export async function runSync(opts: SyncEngineOptions): Promise<SyncResult> {
  const result: SyncResult = {
    uploaded: 0,
    downloaded: 0,
    conflictsResolved: 0,
    skipped: 0,
    errors: [],
  };

  const local = await opts.loadLocal();
  const localById = new Map(local.map((l) => [l.session.id, l]));
  const remoteIds = new Set(await opts.provider.list());

  // Upload missing
  for (const entry of local) {
    if (remoteIds.has(entry.session.id)) continue;
    try {
      const blob = await encryptSessionBlob(entry.session, opts.passphrase, entry.updatedAt);
      await opts.provider.put(blob);
      result.uploaded++;
    } catch (err) {
      result.errors.push({
        sessionId: entry.session.id,
        message: getErrorMessage(err),
      });
    }
  }

  // Download missing + reconcile conflicts
  for (const remoteId of remoteIds) {
    try {
      const blob = await opts.provider.get(remoteId);
      if (!blob) continue;
      const localEntry = localById.get(remoteId);
      if (!localEntry) {
        const session = await decryptSessionBlob(blob, opts.passphrase);
        await opts.upsertLocal(session, blob.updatedAt);
        result.downloaded++;
        continue;
      }
      const winner = resolveConflict(localEntry, { blob });
      if (winner === 'remote') {
        const session = await decryptSessionBlob(blob, opts.passphrase);
        await opts.upsertLocal(session, blob.updatedAt);
        result.conflictsResolved++;
      } else if (blob.updatedAt < localEntry.updatedAt) {
        // Local is newer than remote: re-upload
        const newer = await encryptSessionBlob(
          localEntry.session,
          opts.passphrase,
          localEntry.updatedAt
        );
        await opts.provider.put(newer);
        result.conflictsResolved++;
      } else {
        result.skipped++;
      }
    } catch (err) {
      result.errors.push({
        sessionId: remoteId,
        message: getErrorMessage(err),
      });
    }
  }

  return result;
}
