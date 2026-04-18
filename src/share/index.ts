/**
 * Coach/team share codes.
 *
 * An athlete generates a time-boxed, passphrase-encrypted share bundle
 * containing recent sessions. The bundle is rendered as a short pairing
 * code (or QR) the coach scans into a read-only web/app view. The relay
 * (Cloudflare Worker / Drive signed URL) only ever sees the ciphertext.
 */
import { Session } from '../types';
import * as Crypto from 'expo-crypto';
import { encryptString, decryptString } from '../sync/crypto';

/**
 * Bumped 2 → 3 with the AES-GCM migration. v1/v2 bundles still open.
 */
export const SHARE_PROTOCOL_VERSION = 4;

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
  /**
   * Hex HMAC-SHA256 over (iv || ciphertext). Present on protocol v2 only;
   * v3/v4 use AES-GCM (tag in `ciphertext`); legacy v1 had no integrity check.
   */
  mac?: string;
  /** v4 only: hex per-blob random salt for the scrypt KDF. Absent on v1–v3. */
  salt?: string;
}

/** A sealed share — the bundle itself plus the pairing code coach uses. */
export interface SealedShare {
  bundle: ShareBundle;
  /** Format: `bundleId-w-w-w-w`, e.g. `4F2A-octopus-river-cycle-glacier`. */
  pairingCode: string;
}

/** Default 7-day window. */
export const DEFAULT_SHARE_TTL_DAYS = 7;

const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion

/**
 * 256 short, easy-to-spell English nouns. Used as a base-256 alphabet
 * for passphrase generation: 8 bits of entropy per word.
 *
 * Combined with a 4-word passphrase that's 32 bits of entropy
 * (~4.3 × 10⁹ combinations) — roughly 1,000,000× harder to brute-force
 * than the previous 16-word/3-word design (~12 bits) and large enough
 * that the iterated-SHA-256 KDF (10k rounds) becomes the dominant cost
 * for any offline attack on the relay ciphertext.
 *
 * Length 256 is required so single-byte rejection sampling has zero bias
 * (256 % 256 === 0). If you change this list, keep its length at 256.
 */
const PASSPHRASE_WORDS: readonly string[] = [
  'amber',
  'anchor',
  'apple',
  'arrow',
  'aspen',
  'autumn',
  'azure',
  'bagel',
  'bakery',
  'balcony',
  'bamboo',
  'banjo',
  'barley',
  'basil',
  'basket',
  'beacon',
  'beaver',
  'bench',
  'berry',
  'birch',
  'bishop',
  'bison',
  'blanket',
  'blossom',
  'bobcat',
  'bonsai',
  'boulder',
  'bridge',
  'bronze',
  'brook',
  'bubble',
  'buffer',
  'butler',
  'button',
  'cactus',
  'camel',
  'candle',
  'canoe',
  'canyon',
  'caramel',
  'cardinal',
  'carpet',
  'castle',
  'catfish',
  'cedar',
  'cello',
  'cheetah',
  'cherry',
  'chestnut',
  'chimney',
  'citron',
  'clarinet',
  'clover',
  'cobalt',
  'cobra',
  'coffee',
  'comet',
  'compass',
  'copper',
  'coral',
  'cosmos',
  'cotton',
  'cougar',
  'coyote',
  'cradle',
  'crater',
  'crayon',
  'creek',
  'crimson',
  'crystal',
  'cuckoo',
  'cyclone',
  'dahlia',
  'daisy',
  'dapple',
  'dawn',
  'denim',
  'desert',
  'diamond',
  'dingo',
  'dolphin',
  'donkey',
  'draft',
  'dragon',
  'dunes',
  'eagle',
  'echo',
  'ember',
  'emerald',
  'engine',
  'envelope',
  'epoch',
  'escape',
  'espresso',
  'ether',
  'falcon',
  'fawn',
  'feather',
  'fennel',
  'fern',
  'fiber',
  'fiddle',
  'fjord',
  'flamingo',
  'flannel',
  'flask',
  'flute',
  'forest',
  'fossil',
  'fountain',
  'fox',
  'freezer',
  'galaxy',
  'garlic',
  'geode',
  'ginger',
  'glacier',
  'glove',
  'goblin',
  'gondola',
  'granite',
  'grape',
  'gravel',
  'grove',
  'gull',
  'hammer',
  'harbor',
  'harvest',
  'hazel',
  'heron',
  'hickory',
  'honey',
  'horizon',
  'hornet',
  'iceberg',
  'iguana',
  'indigo',
  'iris',
  'island',
  'ivory',
  'jacket',
  'jaguar',
  'jasmine',
  'jasper',
  'jersey',
  'jewel',
  'jolly',
  'journal',
  'jungle',
  'juniper',
  'kelp',
  'kettle',
  'kiwi',
  'knot',
  'koala',
  'lagoon',
  'lantern',
  'larch',
  'lasso',
  'lavender',
  'ledger',
  'lemon',
  'lichen',
  'lilac',
  'linen',
  'lion',
  'llama',
  'lobster',
  'locket',
  'lotus',
  'lumber',
  'lupine',
  'lynx',
  'magnet',
  'mahogany',
  'mango',
  'maple',
  'marble',
  'marigold',
  'marina',
  'marsh',
  'meadow',
  'melon',
  'mercury',
  'mesa',
  'meteor',
  'mineral',
  'mint',
  'misty',
  'mocha',
  'molten',
  'monsoon',
  'moss',
  'muffin',
  'mulberry',
  'muse',
  'nebula',
  'neptune',
  'nimbus',
  'noble',
  'nomad',
  'nougat',
  'nutmeg',
  'oasis',
  'obsidian',
  'ocean',
  'octopus',
  'olive',
  'onyx',
  'opal',
  'orchard',
  'orchid',
  'origin',
  'otter',
  'oyster',
  'paddle',
  'palette',
  'panda',
  'panther',
  'papaya',
  'parade',
  'parrot',
  'peach',
  'pebble',
  'pelican',
  'pepper',
  'pewter',
  'phoenix',
  'pigeon',
  'pine',
  'plaza',
  'plum',
  'plume',
  'poppy',
  'porcelain',
  'prairie',
  'puma',
  'pumpkin',
  'quartz',
  'quill',
  'quiver',
  'rabbit',
  'rapid',
  'raven',
  'redwood',
  'reef',
  'ribbon',
  'river',
  'robin',
  'rocket',
  'rosemary',
  'rover',
  'ruby',
  'rust',
  'saddle',
  'saffron',
];

if (PASSPHRASE_WORDS.length !== 256) {
  // Compile-time invariant; thrown at module load if violated. Keeps
  // rejection sampling unbiased.
  throw new Error(`PASSPHRASE_WORDS must be 256 entries, got ${PASSPHRASE_WORDS.length}`);
}

/**
 * Returns a uniformly distributed integer in [0, modulo) using
 * single-byte rejection sampling against `Crypto.getRandomBytes`.
 * For modulos that don't divide 256 evenly we discard out-of-range
 * draws so all outcomes have equal probability (no modulo bias).
 */
function randomIndex(modulo: number): number {
  if (modulo <= 0 || modulo > 256) {
    throw new Error(`randomIndex modulo out of range: ${modulo}`);
  }
  const limit = 256 - (256 % modulo);
  // Worst case (modulo=255) the rejection rate is 1/256 — effectively never loops.
  for (;;) {
    const byte = Crypto.getRandomBytes(1)[0];
    if (byte < limit) return byte % modulo;
  }
}

function randomChar(alphabet: string): string {
  return alphabet[randomIndex(alphabet.length)];
}

function randomWord(): string {
  return PASSPHRASE_WORDS[randomIndex(PASSPHRASE_WORDS.length)];
}

/**
 * Generates a new pairing code: a 4-character bundle id (lookup key,
 * collision-avoidance only) plus a CSPRNG-derived 4-word passphrase
 * (cryptographic secret, ~32 bits of entropy).
 */
export function generatePairingCode(): { bundleId: string; passphrase: string } {
  const bundleId = Array.from({ length: 4 }, () => randomChar(ID_ALPHABET)).join('');
  const passphrase = Array.from({ length: 4 }, () => randomWord()).join('-');
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

/**
 * Parses a coach-entered pairing code into bundle id + passphrase.
 * Returns null if malformed.
 */
export function parsePairingCode(code: string): { bundleId: string; passphrase: string } | null {
  if (typeof code !== 'string') return null;
  const trimmed = code.trim().toUpperCase();
  // Expect: BBBB-w-w-w-w (passphrase becomes lowercase after split)
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
  // Cheap pre-check on the unauthenticated envelope expiry to fail fast.
  // The authoritative check happens below against the *decrypted* value.
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

  // Authenticate the envelope's expiry against the encrypted payload.
  // Without this an attacker who can rewrite the envelope (e.g. a
  // compromised relay) could extend any share's lifetime indefinitely
  // without knowing the passphrase.
  if (typeof payload.expiresAt !== 'string' || payload.expiresAt !== bundle.expiresAt) {
    throw new Error('Share envelope has been tampered with');
  }
  // Re-check expiry against the now-authenticated value (defence in depth;
  // identical to the pre-check unless the envelope was rewritten).
  if (now > new Date(payload.expiresAt)) {
    throw new Error('Share has expired');
  }

  return payload;
}
