/**
 * Test-only stub for `@noble/ciphers/aes.js`.
 *
 * jest cannot load the real module because it ships pure ESM inside
 * `node_modules`, which the default ts-jest preset does not transform.
 * Node's built-in `crypto` provides a byte-identical AES-256-GCM
 * implementation (both rely on the same NIST spec / OpenSSL primitives),
 * so the round-trip and tamper tests exercise the real algorithm.
 */
import { createCipheriv, createDecipheriv } from 'crypto';

export function gcm(key: Uint8Array, iv: Uint8Array) {
  return {
    encrypt(plaintext: Uint8Array): Uint8Array {
      const cipher = createCipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(iv));
      const ct = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
      const tag = cipher.getAuthTag();
      return new Uint8Array(Buffer.concat([ct, tag]));
    },
    decrypt(ciphertextWithTag: Uint8Array): Uint8Array {
      const buf = Buffer.from(ciphertextWithTag);
      if (buf.length < 16) throw new Error('ciphertext too short');
      const ct = buf.subarray(0, buf.length - 16);
      const tag = buf.subarray(buf.length - 16);
      const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(iv));
      decipher.setAuthTag(tag);
      return new Uint8Array(Buffer.concat([decipher.update(ct), decipher.final()]));
    },
  };
}
