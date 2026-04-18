/**
 * Scrypt password-based KDF — used by sync/share/backup v4 to replace
 * the previous iterated-SHA-256 KDF.
 *
 * Why scrypt: memory-hardness raises the cost of an offline brute-force
 * attack against the leaked relay/cloud ciphertext to ~16 MB per guess
 * with the parameters chosen here, which is ~10⁴–10⁵× more expensive
 * than the v3 10 000-iteration SHA-256 KDF on commodity GPUs.
 *
 * Why scrypt over Argon2id: scrypt has a mature, audited, pure-JS
 * implementation (`@noble/hashes/scrypt`) that runs in managed Expo
 * without ejecting. Argon2id requires a native bridge that would force
 * a destructive `expo prebuild`. Both are RFC-grade memory-hard PBKDFs;
 * scrypt is what we can actually ship today.
 *
 * Wire-protocol coupling: parameters are *fixed per protocol version*.
 * v4 uses (N=2^14, r=8, p=1, dkLen=32) — about 16 MiB of RAM per
 * derivation, ~50–100 ms on a typical mobile device. If any parameter
 * changes, bump the protocol version (the parameters are not stored
 * alongside the salt — they are implied by the version).
 */
import { scryptAsync } from '@noble/hashes/scrypt.js';

/**
 * Scrypt cost parameters for protocol v4.
 *
 * Picked to balance offline-attack hardness against mobile device
 * battery and UX latency:
 *   - N = 2^14 (16 384) → ~16 MiB working memory per derivation
 *   - r = 8              → standard block size
 *   - p = 1              → no parallelism (mobile cores are scarce)
 *   - dkLen = 32         → AES-256 key size, no truncation needed
 *
 * On a 2024-era phone this completes in ~50 ms. On a desktop GPU
 * cluster, the per-guess memory cost dominates, raising the wall-clock
 * cost of brute-forcing the (~32-bit) pairing-code passphrase from
 * "minutes" (under v3 SHA-256) to "weeks–years" (under v4 scrypt).
 */
export const SCRYPT_V4_PARAMS = {
  N: 1 << 14,
  r: 8,
  p: 1,
  dkLen: 32,
} as const;

/** Random salt size for v4 KDF derivations. 16 bytes is RFC-recommended. */
export const SCRYPT_SALT_LENGTH = 16;

/**
 * Derives a 32-byte AES-256 key from `passphrase` + `salt` using scrypt
 * with the protocol-v4 cost parameters.
 *
 * The `context` argument is folded into the salt so two blobs encrypted
 * with the same passphrase but different (e.g.) sessionIds derive
 * distinct keys even if the random salt ever collides — same defence
 * the v3 KDF provided by passing `context` directly into the seed.
 */
export async function scryptDeriveKey(
  passphrase: string,
  salt: Uint8Array,
  context: string
): Promise<Uint8Array> {
  if (salt.length !== SCRYPT_SALT_LENGTH) {
    throw new Error(`scrypt salt must be ${SCRYPT_SALT_LENGTH} bytes, got ${salt.length}`);
  }
  const enc = new TextEncoder();
  const ctxBytes = enc.encode(`:${context}`);
  const composedSalt = new Uint8Array(salt.length + ctxBytes.length);
  composedSalt.set(salt, 0);
  composedSalt.set(ctxBytes, salt.length);
  return scryptAsync(enc.encode(passphrase), composedSalt, SCRYPT_V4_PARAMS);
}
