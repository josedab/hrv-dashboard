/**
 * Coach/team share codes — public API façade.
 *
 * An athlete generates a time-boxed, passphrase-encrypted share bundle
 * containing recent sessions. The bundle is rendered as a short pairing
 * code (or QR) the coach scans into a read-only web/app view. The relay
 * (Cloudflare Worker / Drive signed URL) only ever sees the ciphertext.
 *
 * Implementation split across:
 *   - `share/pairingCode.ts` — CSPRNG code generation + parsing
 *   - `share/sessions.ts` — session filtering by lookback window
 *   - `share/index.ts` — seal/unseal orchestration (this file)
 */
import { Session } from '../types';
import { encryptString, decryptString } from '../sync/crypto';
import { generatePairingCode, parsePairingCode } from './pairingCode';
import { selectShareableSessions } from './sessions';

// Re-export extracted modules for backward compatibility
export { generatePairingCode, parsePairingCode } from './pairingCode';
export { selectShareableSessions } from './sessions';

/** Bumped with AES-GCM migration. v1/v2/v3 bundles still open. */
export const SHARE_PROTOCOL_VERSION = 4;

/** Plaintext payload before encryption. */
export interface SharePayload {
  protocolVersion: number;
  athleteName: string;
  generatedAt: string;
  expiresAt: string;
  sessions: Session[];
}

/** What the coach receives — the encrypted bundle. */
export interface ShareBundle {
  protocolVersion: number;
  bundleId: string;
  expiresAt: string;
  iv: string;
  ciphertext: string;
  mac?: string;
  salt?: string;
}

/** A sealed share — the bundle plus the pairing code. */
export interface SealedShare {
  bundle: ShareBundle;
  pairingCode: string;
}

/** Default 7-day window. */
export const DEFAULT_SHARE_TTL_DAYS = 7;

export interface SealOptions {
  athleteName: string;
  lookbackDays?: number;
  ttlDays?: number;
  now?: () => Date;
}

/** Builds and encrypts a share bundle from local sessions. */
export async function sealShare(allSessions: Session[], opts: SealOptions): Promise<SealedShare> {
  const now = opts.now ? opts.now() : new Date();
  const ttl = opts.ttlDays ?? DEFAULT_SHARE_TTL_DAYS;
  const lookback = opts.lookbackDays ?? 30;

  const expiresAt = new Date(now.getTime() + ttl * 86_400_000).toISOString();
  const sessions = selectShareableSessions(allSessions, lookback);

  const payload: SharePayload = {
    protocolVersion: SHARE_PROTOCOL_VERSION,
    athleteName: opts.athleteName.trim() || 'Athlete',
    generatedAt: now.toISOString(),
    expiresAt,
    sessions,
  };

  const { bundleId, passphrase } = generatePairingCode();
  const { ciphertext, iv, mac, version, salt } = await encryptString(
    JSON.stringify(payload),
    passphrase,
    bundleId
  );

  return {
    bundle: {
      protocolVersion: version ?? SHARE_PROTOCOL_VERSION,
      bundleId,
      expiresAt,
      iv,
      ciphertext,
      ...(mac ? { mac } : {}),
      ...(salt ? { salt } : {}),
    },
    pairingCode: `${bundleId}-${passphrase}`,
  };
}

export interface OpenOptions {
  now?: () => Date;
}

/**
 * Decrypts and validates a share bundle. Throws on:
 * - expired bundle
 * - wrong passphrase / corrupt ciphertext
 * - protocol version newer than this client
 */
export async function openShare(
  bundle: ShareBundle,
  pairingCode: string,
  opts: OpenOptions = {}
): Promise<SharePayload> {
  if (typeof bundle.protocolVersion !== 'number' || !Number.isFinite(bundle.protocolVersion)) {
    throw new Error('Share bundle is missing or has invalid protocolVersion');
  }
  if (bundle.protocolVersion > SHARE_PROTOCOL_VERSION) {
    throw new Error(
      `Share protocol v${bundle.protocolVersion} is newer than this client (v${SHARE_PROTOCOL_VERSION}); please update`
    );
  }
  if (bundle.protocolVersion === 4 && !bundle.salt) {
    throw new Error('Share v4 bundle is missing required salt');
  }
  if (bundle.protocolVersion !== 4 && bundle.salt) {
    throw new Error(`Share v${bundle.protocolVersion} bundle must not carry a salt field`);
  }

  const now = opts.now ? opts.now() : new Date();
  if (now > new Date(bundle.expiresAt)) {
    throw new Error('Share has expired');
  }

  const parsed = parsePairingCode(pairingCode);
  if (!parsed) {
    throw new Error('Invalid pairing code format');
  }
  if (parsed.bundleId.toUpperCase() !== bundle.bundleId.toUpperCase()) {
    throw new Error('Pairing code does not match bundle');
  }

  const plaintext = await decryptString(
    bundle.ciphertext,
    parsed.passphrase,
    bundle.bundleId,
    bundle.iv,
    bundle.mac,
    bundle.protocolVersion,
    bundle.salt
  );

  let payload: SharePayload;
  try {
    payload = JSON.parse(plaintext) as SharePayload;
  } catch {
    throw new Error('Decryption failed — wrong passphrase or corrupt bundle');
  }

  if (
    !payload ||
    typeof payload.protocolVersion !== 'number' ||
    payload.protocolVersion < 1 ||
    payload.protocolVersion > SHARE_PROTOCOL_VERSION
  ) {
    throw new Error('Decrypted payload is malformed');
  }

  if (typeof payload.expiresAt !== 'string' || payload.expiresAt !== bundle.expiresAt) {
    throw new Error('Share envelope has been tampered with');
  }
  if (now > new Date(payload.expiresAt)) {
    throw new Error('Share has expired');
  }

  return payload;
}
