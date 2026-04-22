/**
 * Shared low-level encoding helpers used by crypto/backup/sync modules.
 *
 * `getRandomBytes` is backed by `expo-crypto`'s CSPRNG. It MUST be used for
 * any cryptographic context (salts, IVs, tokens). Do not substitute
 * `Math.random()` — it is not cryptographically secure.
 */
import * as Crypto from 'expo-crypto';

/** Returns `length` cryptographically secure random bytes. */
export async function getRandomBytes(length: number): Promise<Uint8Array> {
  if (!Number.isInteger(length) || length < 0) {
    throw new Error(`Invalid random byte length: ${length}`);
  }
  // expo-crypto returns a Uint8Array on all supported platforms.
  return await Crypto.getRandomBytesAsync(length);
}

/** Lower-case hex encoding of an arbitrary byte array. */
export function arrayToHex(arr: Uint8Array): string {
  let out = '';
  for (let i = 0; i < arr.length; i++) {
    out += arr[i].toString(16).padStart(2, '0');
  }
  return out;
}

/** Inverse of {@link arrayToHex}. Returns an empty array on empty/invalid input. */
export function hexToArray(hex: string): Uint8Array {
  if (!hex) return new Uint8Array(0);
  const matches = hex.match(/.{1,2}/g);
  if (!matches) return new Uint8Array(0);
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

/** SHA-256 block size in bytes (RFC 6234). */
const HMAC_BLOCK_SIZE = 64;

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const result = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data);
  return typeof result === 'string' ? hexToArray(result) : new Uint8Array(result);
}

/**
 * HMAC-SHA-256 (RFC 2104) implemented in userspace because `expo-crypto`
 * does not expose a native HMAC primitive.
 *
 * Used by the backup module for authenticated integrity (encrypt-then-MAC):
 * a tampered ciphertext or wrong key produces a constant-time-detectable
 * MAC mismatch instead of relying on plaintext SHA-256 (which is forgeable).
 *
 * Note: For a cryptographically rigorous AEAD we'd want libsodium or a
 * native AES-GCM binding. Until that dependency lands, HMAC over
 * (iv || ciphertext) is a meaningful upgrade over the prior unkeyed SHA-256.
 */
export async function hmacSha256(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  let normalisedKey = key;
  if (normalisedKey.length > HMAC_BLOCK_SIZE) {
    normalisedKey = await sha256(normalisedKey);
  }
  if (normalisedKey.length < HMAC_BLOCK_SIZE) {
    const padded = new Uint8Array(HMAC_BLOCK_SIZE);
    padded.set(normalisedKey);
    normalisedKey = padded;
  }

  const innerPad = new Uint8Array(HMAC_BLOCK_SIZE);
  const outerPad = new Uint8Array(HMAC_BLOCK_SIZE);
  for (let i = 0; i < HMAC_BLOCK_SIZE; i++) {
    innerPad[i] = normalisedKey[i] ^ 0x36;
    outerPad[i] = normalisedKey[i] ^ 0x5c;
  }

  const inner = new Uint8Array(HMAC_BLOCK_SIZE + message.length);
  inner.set(innerPad);
  inner.set(message, HMAC_BLOCK_SIZE);
  const innerHash = await sha256(inner);

  const outer = new Uint8Array(HMAC_BLOCK_SIZE + innerHash.length);
  outer.set(outerPad);
  outer.set(innerHash, HMAC_BLOCK_SIZE);
  return await sha256(outer);
}

/**
 * Constant-time byte-array equality. Use for MAC verification to avoid
 * timing side channels. The length comparison itself is constant-time:
 * we XOR all bytes up to the longer array and also fold a length-mismatch
 * flag into the diff accumulator.
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}
