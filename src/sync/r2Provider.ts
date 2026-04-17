/**
 * Cloudflare R2 sync provider + Argon2id-style strengthened KDF.
 *
 * R2 exposes an S3-compatible REST API; this provider PUTs/GETs blobs
 * keyed by `r2://<bucket>/sessions/<sessionId>.blob`. Auth uses an
 * AWS-v4 pre-signed URL generator the host app supplies (so secrets
 * never leave the user's keychain).
 *
 * The KDF here is a higher-iteration variant of the existing PBKDF2-ish
 * SHA-256 cascade in `crypto.ts`. We bump iterations from 1k → 100k and
 * mix in a per-user salt so that a stolen passphrase can't be brute-
 * forced offline against a known-plaintext attack.
 */
import * as Crypto from 'expo-crypto';
import { EncryptedSessionBlob, SyncProvider, SYNC_PROTOCOL_VERSION } from './index';

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

export interface PresignedUrlResolver {
  /** Returns a presigned URL valid for the requested HTTP method. */
  resolve(
    method: 'GET' | 'PUT' | 'DELETE',
    key: string,
    contentType?: string
  ): Promise<string>;
  /** Lists all keys under the sessions/ prefix; presigned per-call as needed. */
  list(): Promise<string[]>;
}

export interface R2ProviderOptions {
  bucketName: string;
  presigner: PresignedUrlResolver;
  fetchImpl?: FetchImpl;
}

export class R2Provider implements SyncProvider {
  readonly id = 'cloudflare-r2';
  private readonly fetchImpl: FetchImpl;

  constructor(private readonly opts: R2ProviderOptions) {
    this.fetchImpl =
      opts.fetchImpl ??
      (typeof fetch === 'function' ? (fetch.bind(globalThis) as FetchImpl) : null) ??
      ((() => {
        throw new Error('No fetch implementation; pass fetchImpl');
      }) as unknown as FetchImpl);
  }

  private keyOf(sessionId: string): string {
    return `sessions/${sessionId}.blob`;
  }

  async list(): Promise<string[]> {
    const keys = await this.opts.presigner.list();
    return keys
      .filter((k) => k.startsWith('sessions/') && k.endsWith('.blob'))
      .map((k) => k.slice('sessions/'.length, -'.blob'.length));
  }

  async get(sessionId: string): Promise<EncryptedSessionBlob | null> {
    const url = await this.opts.presigner.resolve('GET', this.keyOf(sessionId));
    const r = await this.fetchImpl(url);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`R2 GET ${r.status}`);
    const json = (await r.json()) as EncryptedSessionBlob;
    if (json.protocolVersion > SYNC_PROTOCOL_VERSION) {
      throw new Error(`R2 blob protocol v${json.protocolVersion} newer than client`);
    }
    return json;
  }

  async put(blob: EncryptedSessionBlob): Promise<void> {
    const url = await this.opts.presigner.resolve(
      'PUT',
      this.keyOf(blob.sessionId),
      'application/json'
    );
    const r = await this.fetchImpl(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blob),
    });
    if (!r.ok) throw new Error(`R2 PUT ${r.status}`);
  }

  async remove(sessionId: string): Promise<void> {
    const url = await this.opts.presigner.resolve('DELETE', this.keyOf(sessionId));
    const r = await this.fetchImpl(url, { method: 'DELETE' });
    if (!r.ok && r.status !== 404) throw new Error(`R2 DELETE ${r.status}`);
  }
}

// ─── Strengthened KDF ─────────────────────────────────────────────────────

const STRONG_KDF_ITERATIONS = 100_000;

function arrayToHex(arr: Uint8Array): string {
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToArray(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) return new Uint8Array(0);
  return new Uint8Array(matches.map((b) => parseInt(b, 16)));
}

async function digest(input: Uint8Array): Promise<Uint8Array> {
  const out = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, input);
  return typeof out === 'string' ? hexToArray(out) : new Uint8Array(out);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const length = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

/**
 * Strengthened key derivation. Same overall shape as `deriveKey` in
 * `crypto.ts` but with 100x more iterations and an explicit per-user
 * salt. Use for the `encryptionKey` you hand to `encryptSessionBlob`.
 *
 * NOT a true Argon2id — that requires a native module. This is a
 * defense-in-depth stop-gap that a stolen-passphrase attacker pays
 * 100k SHA-256s per guess for, instead of 1k.
 */
export async function deriveStrongKey(
  passphrase: string,
  userSalt: string,
  context: string
): Promise<string> {
  const enc = new TextEncoder();
  let key = concat(
    enc.encode(passphrase),
    enc.encode(userSalt),
    enc.encode(context)
  );
  for (let i = 0; i < STRONG_KDF_ITERATIONS; i++) {
    key = await digest(key);
  }
  return arrayToHex(key);
}

/**
 * Bootstrap helper: generate a random 32-byte user salt at sign-up and
 * persist it (settings table). Re-deriving the strong key always uses
 * the same salt for the same user.
 */
export async function generateUserSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return arrayToHex(bytes);
}
