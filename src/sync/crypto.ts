/**
 * Sync-layer crypto.
 *
 * Versions:
 *   v1 — SHA-256 CTR-mode XOR, no integrity tag (legacy, read-only).
 *   v2 — SHA-256 CTR-mode XOR + HMAC-SHA-256 over (iv || ciphertext)
 *        with a domain-separated MAC key (legacy, read-only).
 *   v3 — AES-256-GCM with a 10k-iter SHA-256 KDF (read-only).
 *   v4 — **AES-256-GCM with a scrypt KDF** (N=2^14, r=8, p=1) and a
 *        per-blob random salt. The KDF is memory-hard, so offline
 *        brute-force attacks against leaked relay/cloud ciphertext are
 *        ~10⁴–10⁵× more expensive per guess than under v3.
 *
 * New encryptions always emit v4. v1–v3 blobs are still decryptable so
 * existing cloud copies and shared payloads keep working until they're
 * re-uploaded — see {@link decryptString}.
 *
 * The `EncryptedString` shape stays wire-compatible:
 *   - v4 sets `version: 4`, packs the GCM tag into the trailing 16 bytes
 *     of `ciphertext`, leaves `mac` empty, and adds a `salt` field.
 *   - v3 sets `version: 3`, packs the GCM tag, leaves `mac` and `salt` empty.
 *   - v2 sets `mac` to the 64-hex HMAC tag, no `version`, no `salt`.
 *   - v1 omits `mac` entirely.
 */
import * as Crypto from 'expo-crypto';
import { arrayToHex, hexToArray, getRandomBytes } from '../utils/encoding';
import { aesGcmEncrypt, aesGcmDecrypt } from './aesGcm';
import { scryptDeriveKey, SCRYPT_SALT_LENGTH } from './scryptKdf';

const KDF_ITERATIONS = 10_000;
const IV_LENGTH = 12;
const MAC_LENGTH = 32;
const AES_KEY_LENGTH = 32; // AES-256

async function digest(input: Uint8Array): Promise<Uint8Array> {
  const out = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, input);
  return typeof out === 'string' ? hexToArray(out) : new Uint8Array(out);
}

/** PBKDF2-like key derivation. Always returns 32 bytes (SHA-256 output). */
async function deriveKey(passphrase: string, context: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  let key = encoder.encode(`${passphrase}:${context}`);
  for (let i = 0; i < KDF_ITERATIONS; i++) {
    key = await digest(key);
  }
  return key;
}

/** Domain-separated MAC key derived from the same passphrase. (v2 only.) */
async function deriveMacKey(passphrase: string, context: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const seed = encoder.encode(`mac:${passphrase}:${context}`);
  let key = await digest(seed);
  for (let i = 0; i < 256; i++) {
    key = await digest(key);
  }
  return key;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** HMAC-SHA256 (RFC 2104). Used only for verifying legacy v2 blobs. */
async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const blockSize = 64;
  let k = key;
  if (k.length > blockSize) k = await digest(k);
  if (k.length < blockSize) {
    const padded = new Uint8Array(blockSize);
    padded.set(k);
    k = padded;
  }
  const okp = new Uint8Array(blockSize);
  const ikp = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    okp[i] = k[i] ^ 0x5c;
    ikp[i] = k[i] ^ 0x36;
  }
  const inner = await digest(concat(ikp, data));
  return digest(concat(okp, inner));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** v1/v2 stream cipher (SHA-256 keystream). Read-only path. */
async function xorStream(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  const out = new Uint8Array(data.length);
  const blockSize = 32;
  for (let offset = 0; offset < data.length; offset += blockSize) {
    const counter = new Uint8Array(4);
    const blockNum = Math.floor(offset / blockSize);
    counter[0] = (blockNum >> 24) & 0xff;
    counter[1] = (blockNum >> 16) & 0xff;
    counter[2] = (blockNum >> 8) & 0xff;
    counter[3] = blockNum & 0xff;
    const keystream = await digest(new Uint8Array([...key, ...iv, ...counter]));
    const end = Math.min(offset + blockSize, data.length);
    for (let i = offset; i < end; i++) {
      out[i] = data[i] ^ keystream[i - offset];
    }
  }
  return out;
}

export interface EncryptedString {
  ciphertext: string;
  iv: string;
  /**
   * v2 only: hex HMAC-SHA-256 over (iv || ciphertext). Empty for v3/v4
   * (GCM tag is appended to `ciphertext` instead). Optional for v1.
   */
  mac: string;
  /**
   * Format version. Defaults to 2 when absent (the previous on-the-wire
   * default); explicit `3` selects AES-GCM with the iterated-SHA-256 KDF;
   * explicit `4` selects AES-GCM with the scrypt KDF. New encryptions
   * always set 4.
   */
  version?: number;
  /**
   * v4 only: hex per-blob random salt for the scrypt KDF
   * ({@link SCRYPT_SALT_LENGTH} bytes / {@link SCRYPT_SALT_LENGTH}*2 hex
   * chars). Absent on v1–v3.
   */
  salt?: string;
}

export async function encryptString(
  plaintext: string,
  passphrase: string,
  context: string
): Promise<EncryptedString> {
  // v4 = scrypt KDF + AES-256-GCM. Each call gets a fresh random salt
  // so the same (passphrase, context) pair derives a different key per
  // encryption — limits the blast radius of a key compromise to a
  // single blob.
  const salt = await getRandomBytes(SCRYPT_SALT_LENGTH);
  const key = await scryptDeriveKey(passphrase, salt, context);
  const iv = await getRandomBytes(IV_LENGTH);
  const data = new TextEncoder().encode(plaintext);
  const ct = aesGcmEncrypt(key, iv, data);
  return {
    ciphertext: arrayToHex(ct),
    iv: arrayToHex(iv),
    mac: '',
    version: 4,
    salt: arrayToHex(salt),
  };
}

/**
 * Decrypts a string. Auto-detects the format:
 *   - `version === 4` → AES-GCM with scrypt KDF (requires `salt`).
 *   - `version === 3` → AES-GCM with iterated-SHA-256 KDF (legacy).
 *   - `mac` non-empty (v2)  → CTR-XOR with HMAC verification.
 *   - `mac` omitted   (v1)  → CTR-XOR, no integrity check (legacy).
 */
export async function decryptString(
  ciphertextHex: string,
  passphrase: string,
  context: string,
  ivHex: string,
  macHex?: string,
  version?: number,
  saltHex?: string
): Promise<string> {
  const iv = hexToArray(ivHex);
  const data = hexToArray(ciphertextHex);

  // v4: scrypt KDF + AES-GCM. Salt is required.
  if (version === 4) {
    if (!saltHex) {
      throw new Error('v4 blob is missing required salt field');
    }
    const salt = hexToArray(saltHex);
    if (salt.length !== SCRYPT_SALT_LENGTH) {
      throw new Error(
        `v4 blob salt has wrong length: expected ${SCRYPT_SALT_LENGTH}, got ${salt.length}`
      );
    }
    const key = await scryptDeriveKey(passphrase, salt, context);
    let pt: Uint8Array;
    try {
      pt = aesGcmDecrypt(key, iv, data);
    } catch {
      throw new Error('Authentication failed: blob has been tampered with or wrong passphrase');
    }
    return new TextDecoder().decode(pt);
  }

  // v3: real AES-GCM with the legacy iterated-SHA-256 KDF.
  if (version === 3) {
    const key = await deriveKey(passphrase, context);
    const aesKey = key.length === AES_KEY_LENGTH ? key : key.slice(0, AES_KEY_LENGTH);
    let pt: Uint8Array;
    try {
      pt = aesGcmDecrypt(aesKey, iv, data);
    } catch {
      throw new Error('Authentication failed: blob has been tampered with or wrong passphrase');
    }
    return new TextDecoder().decode(pt);
  }

  // v2: HMAC-then-decrypt.
  if (macHex !== undefined && macHex.length > 0) {
    const macKey = await deriveMacKey(passphrase, context);
    const expected = await hmacSha256(macKey, concat(iv, data));
    const provided = hexToArray(macHex);
    if (provided.length !== MAC_LENGTH || !constantTimeEqual(expected, provided)) {
      throw new Error('Authentication failed: blob has been tampered with or wrong passphrase');
    }
  }

  // v1/v2 plaintext recovery (CTR-XOR is symmetric).
  const key = await deriveKey(passphrase, context);
  const pt = await xorStream(data, key, iv);
  return new TextDecoder().decode(pt);
}
