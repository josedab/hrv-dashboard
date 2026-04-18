/**
 * Tiny AES-256-GCM adapter.
 *
 * Production uses {@link https://github.com/paulmillr/noble-ciphers `@noble/ciphers`}
 * — a pure-JS, audited (Trail of Bits) AES-GCM implementation that works in
 * managed Expo with no native dependencies. We isolate it behind this module
 * so jest can swap it for Node's native `crypto` in tests (the jest runner
 * cannot transform ESM files inside `node_modules` without extra tooling).
 *
 * Both `encrypt` and `decrypt` follow the standard GCM convention where the
 * 16-byte authentication tag is appended to the ciphertext.
 */
import { gcm } from '@noble/ciphers/aes.js';

/** AES-256-GCM encrypt. Returns ciphertext concatenated with 16-byte tag. */
export function aesGcmEncrypt(key: Uint8Array, iv: Uint8Array, plaintext: Uint8Array): Uint8Array {
  if (key.length !== 32) throw new Error(`AES-GCM key must be 32 bytes (got ${key.length})`);
  if (iv.length !== 12) throw new Error(`AES-GCM IV must be 12 bytes (got ${iv.length})`);
  return gcm(key, iv).encrypt(plaintext);
}

/**
 * AES-256-GCM decrypt. Throws if the tag does not verify (wrong key,
 * tampered ciphertext, or tampered IV).
 */
export function aesGcmDecrypt(
  key: Uint8Array,
  iv: Uint8Array,
  ciphertextWithTag: Uint8Array
): Uint8Array {
  if (key.length !== 32) throw new Error(`AES-GCM key must be 32 bytes (got ${key.length})`);
  if (iv.length !== 12) throw new Error(`AES-GCM IV must be 12 bytes (got ${iv.length})`);
  if (ciphertextWithTag.length < 16) {
    throw new Error('AES-GCM ciphertext too short (missing 16-byte tag)');
  }
  return gcm(key, iv).decrypt(ciphertextWithTag);
}
