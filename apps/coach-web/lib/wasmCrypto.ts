/**
 * WASM cipher scaffold. The v1 coach web only accepts unencrypted JSON
 * dumps; the encrypted `.hrvbak` path lands here when the libsodium-js
 * (or noble-ciphers WASM) bundle is wired in.
 *
 * Surface kept minimal so callers can switch implementations transparently.
 */
export interface CipherImpl {
  decryptBundle(ciphertext: Uint8Array, passphrase: string, salt: Uint8Array): Promise<Uint8Array>;
}

let installed: CipherImpl | null = null;

export function installCipher(impl: CipherImpl): void {
  installed = impl;
}

export function getCipher(): CipherImpl {
  if (!installed) {
    throw new Error(
      'No WASM cipher installed. Call installCipher() with a libsodium/noble-ciphers backed implementation before loading encrypted backups.'
    );
  }
  return installed;
}

/** Best-effort sniffer: a backup bundle starts with a magic header
 *  if it's encrypted, otherwise it's plain JSON. */
export function isEncryptedBundle(bytes: Uint8Array): boolean {
  // Magic: "HRVE" (HRV Encrypted)
  return bytes.length >= 4 &&
    bytes[0] === 0x48 && bytes[1] === 0x52 && bytes[2] === 0x56 && bytes[3] === 0x45;
}
