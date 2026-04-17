/**
 * Sync-layer crypto: thin wrapper around expo-crypto SHA-256 CTR stream
 * cipher with PBKDF2-like key derivation. Mirrors the algorithm used by
 * {@link ../utils/backup} so the formats stay compatible.
 *
 * The key is derived from `passphrase + context`, where `context` is an
 * additional binding string (e.g. the session id) chosen by the caller.
 * This per-blob key derivation prevents catastrophic keystream reuse if
 * the same IV ever collided across blobs.
 */
import * as Crypto from 'expo-crypto';

const KDF_ITERATIONS = 1000;
const IV_LENGTH = 12;

function arrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToArray(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) return new Uint8Array(0);
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

async function digest(input: Uint8Array): Promise<Uint8Array> {
  const out = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, input);
  return typeof out === 'string' ? hexToArray(out) : new Uint8Array(out);
}

/** PBKDF2-like key derivation. */
async function deriveKey(passphrase: string, context: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  let key = encoder.encode(`${passphrase}:${context}`);
  for (let i = 0; i < KDF_ITERATIONS; i++) {
    key = await digest(key);
  }
  return key;
}

async function xorStream(
  data: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
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
}

export async function encryptString(
  plaintext: string,
  passphrase: string,
  context: string
): Promise<EncryptedString> {
  const key = await deriveKey(passphrase, context);
  const iv = getRandomBytes(IV_LENGTH);
  const data = new TextEncoder().encode(plaintext);
  const ct = await xorStream(data, key, iv);
  return { ciphertext: arrayToHex(ct), iv: arrayToHex(iv) };
}

export async function decryptString(
  ciphertextHex: string,
  passphrase: string,
  context: string,
  ivHex: string
): Promise<string> {
  const key = await deriveKey(passphrase, context);
  const iv = hexToArray(ivHex);
  const data = hexToArray(ciphertextHex);
  const pt = await xorStream(data, key, iv);
  return new TextDecoder().decode(pt);
}
