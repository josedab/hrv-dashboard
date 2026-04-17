/**
 * Coach/team share codes.
 *
 * An athlete generates a time-boxed, passphrase-encrypted share bundle
 * containing recent sessions. The bundle is rendered as a short pairing
 * code (or QR) the coach scans into a read-only web/app view. The relay
 * (Cloudflare Worker / Drive signed URL) only ever sees the ciphertext.
 */
import { Session } from '../types';
import { encryptString, decryptString } from '../sync/crypto';

export const SHARE_PROTOCOL_VERSION = 1;

/** Plaintext payload before encryption. */
export interface SharePayload {
  protocolVersion: number;
  athleteName: string;
  /** Inclusive ISO 8601 UTC. */
  generatedAt: string;
  /** Share is valid until this UTC moment. Decoders MUST reject afterward. */
  expiresAt: string;
  sessions: Session[];
}

/** What the coach receives — the encrypted bundle. */
export interface ShareBundle {
  protocolVersion: number;
  /** 4-character human-friendly id used to look up the bundle in a relay. */
  bundleId: string;
  expiresAt: string;
  iv: string;
  ciphertext: string;
}

/** A sealed share — the bundle itself plus the pairing code coach uses. */
export interface SealedShare {
  bundle: ShareBundle;
  /** Format: `bundleId-passphrase`, e.g. `4F2A-octopus-river-cycle`. */
  pairingCode: string;
}

/** Default 7-day window. */
export const DEFAULT_SHARE_TTL_DAYS = 7;

const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
const PASSPHRASE_WORDS = [
  'octopus',
  'river',
  'cycle',
  'meadow',
  'amber',
  'silver',
  'forest',
  'comet',
  'lantern',
  'pebble',
  'storm',
  'velvet',
  'harbor',
  'orbit',
  'spruce',
  'glacier',
];

function randomChar(alphabet: string): string {
  return alphabet[Math.floor(Math.random() * alphabet.length)];
}

function randomWord(): string {
  return PASSPHRASE_WORDS[Math.floor(Math.random() * PASSPHRASE_WORDS.length)];
}

/** Generates a new pairing code: 4 chars + 3 dictionary words. */
export function generatePairingCode(): { bundleId: string; passphrase: string } {
  const bundleId = Array.from({ length: 4 }, () => randomChar(ID_ALPHABET)).join('');
  const passphrase = `${randomWord()}-${randomWord()}-${randomWord()}`;
  return { bundleId, passphrase };
}

/**
 * Filters sessions to those within the last `lookbackDays` days.
 * Returns a new array; original input is not mutated.
 */
export function selectShareableSessions(sessions: Session[], lookbackDays: number): Session[] {
  if (lookbackDays <= 0) return [];
  const cutoff = Date.now() - lookbackDays * 86_400_000;
  return sessions.filter((s) => Date.parse(s.timestamp) >= cutoff);
}

export interface SealOptions {
  athleteName: string;
  lookbackDays?: number;
  ttlDays?: number;
  /** Override clock for tests. */
  now?: () => Date;
}

/** Builds and encrypts a share bundle from local sessions. */
export async function sealShare(
  allSessions: Session[],
  opts: SealOptions
): Promise<SealedShare> {
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
  const { ciphertext, iv } = await encryptString(JSON.stringify(payload), passphrase, bundleId);

  return {
    bundle: {
      protocolVersion: SHARE_PROTOCOL_VERSION,
      bundleId,
      expiresAt,
      iv,
      ciphertext,
    },
    pairingCode: `${bundleId}-${passphrase}`,
  };
}

/**
 * Parses a coach-entered pairing code into bundle id + passphrase.
 * Returns null if malformed.
 */
export function parsePairingCode(
  code: string
): { bundleId: string; passphrase: string } | null {
  if (typeof code !== 'string') return null;
  const trimmed = code.trim().toUpperCase();
  // Expect: BBBB-word-word-word (passphrase becomes lowercase after split)
  const match = trimmed.match(/^([A-Z0-9]{4})-([A-Za-z-]+)$/i);
  if (!match) return null;
  const passphrase = match[2].toLowerCase();
  if (!passphrase.includes('-')) return null;
  return { bundleId: match[1], passphrase };
}

export interface OpenOptions {
  /** Override clock for tests. */
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
  if (bundle.protocolVersion > SHARE_PROTOCOL_VERSION) {
    throw new Error(
      `Share protocol v${bundle.protocolVersion} is newer than this client (v${SHARE_PROTOCOL_VERSION}); please update`
    );
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
    bundle.iv
  );

  let payload: SharePayload;
  try {
    payload = JSON.parse(plaintext) as SharePayload;
  } catch {
    throw new Error('Decryption failed — wrong passphrase or corrupt bundle');
  }

  if (!payload || payload.protocolVersion !== SHARE_PROTOCOL_VERSION) {
    throw new Error('Decrypted payload is malformed');
  }

  return payload;
}
