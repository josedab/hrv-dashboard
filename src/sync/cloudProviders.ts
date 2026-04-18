/**
 * Cloud sync provider implementations.
 *
 * Each provider is a thin HTTP client that maps the {@link SyncProvider}
 * interface to a concrete backend. Blobs are already client-side encrypted,
 * so providers only ever see opaque ciphertext.
 *
 * Both providers depend on `globalThis.fetch` (available in Expo via the
 * polyfilled WHATWG fetch). Tests inject a `fetchImpl` to avoid network.
 */
import { EncryptedSessionBlob, SyncProvider, SYNC_PROTOCOL_VERSION } from './index';

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

function defaultFetch(): FetchImpl {
  if (typeof fetch === 'function') return fetch.bind(globalThis);
  throw new Error('No fetch implementation available; pass fetchImpl in options');
}

// ─── Supabase ───────────────────────────────────────────────────────────────

export interface SupabaseProviderOptions {
  /** Supabase project URL, e.g. https://abcd.supabase.co */
  url: string;
  /** Supabase anon key (server enforces RLS by user). */
  anonKey: string;
  /** End-user JWT. */
  accessToken: string;
  /** Table name; default `hrv_session_blobs`. */
  table?: string;
  fetchImpl?: FetchImpl;
}

interface SupabaseRow {
  session_id: string;
  protocol_version: number;
  updated_at: string;
  iv: string;
  ciphertext: string;
  /** Hex HMAC for legacy v2 blobs; null/undefined for v3/v4 GCM. */
  mac?: string | null;
  /** Hex per-blob random salt for v4 scrypt KDF; null/undefined for v1–v3. */
  salt?: string | null;
}

/**
 * Supabase Postgres-backed provider. Expects a table:
 *
 *   create table hrv_session_blobs (
 *     user_id uuid not null references auth.users on delete cascade,
 *     session_id text not null,
 *     protocol_version int not null,
 *     updated_at timestamptz not null,
 *     iv text not null,
 *     ciphertext text not null,
 *     mac text,
 *     salt text,
 *     primary key (user_id, session_id)
 *   );
 *   alter table hrv_session_blobs enable row level security;
 *   create policy own_rows on hrv_session_blobs
 *     using (auth.uid() = user_id) with check (auth.uid() = user_id);
 *
 * `mac` is nullable: only legacy v2 blobs need it (HMAC verification).
 * `salt` is nullable: only v4 blobs need it (scrypt KDF input). Existing
 * deployments must run `alter table hrv_session_blobs add column salt text;`
 * before this client version uploads anything.
 */
export class SupabaseSyncProvider implements SyncProvider {
  readonly id = 'supabase';
  private readonly url: string;
  private readonly anonKey: string;
  private readonly accessToken: string;
  private readonly table: string;
  private readonly fetchImpl: FetchImpl;

  constructor(opts: SupabaseProviderOptions) {
    this.url = opts.url.replace(/\/+$/, '');
    this.anonKey = opts.anonKey;
    this.accessToken = opts.accessToken;
    this.table = opts.table ?? 'hrv_session_blobs';
    this.fetchImpl = opts.fetchImpl ?? defaultFetch();
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.anonKey,
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  private endpoint(query = ''): string {
    return `${this.url}/rest/v1/${this.table}${query}`;
  }

  async list(): Promise<string[]> {
    const res = await this.fetchImpl(this.endpoint('?select=session_id'), {
      method: 'GET',
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Supabase list failed: ${res.status}`);
    const rows = (await res.json()) as { session_id: string }[];
    return rows.map((r) => r.session_id);
  }

  async get(sessionId: string): Promise<EncryptedSessionBlob | null> {
    const q = `?session_id=eq.${encodeURIComponent(sessionId)}&select=*&limit=1`;
    const res = await this.fetchImpl(this.endpoint(q), {
      method: 'GET',
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Supabase get failed: ${res.status}`);
    const rows = (await res.json()) as SupabaseRow[];
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      protocolVersion: r.protocol_version,
      sessionId: r.session_id,
      updatedAt: r.updated_at,
      iv: r.iv,
      ciphertext: r.ciphertext,
      ...(r.mac ? { mac: r.mac } : {}),
      ...(r.salt ? { salt: r.salt } : {}),
    };
  }

  async put(blob: EncryptedSessionBlob): Promise<void> {
    const row: SupabaseRow = {
      session_id: blob.sessionId,
      protocol_version: blob.protocolVersion,
      updated_at: blob.updatedAt,
      iv: blob.iv,
      ciphertext: blob.ciphertext,
      mac: blob.mac ?? null,
      salt: blob.salt ?? null,
    };
    const res = await this.fetchImpl(this.endpoint(), {
      method: 'POST',
      headers: this.headers({ Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(`Supabase put failed: ${res.status}`);
  }

  async remove(sessionId: string): Promise<void> {
    const q = `?session_id=eq.${encodeURIComponent(sessionId)}`;
    const res = await this.fetchImpl(this.endpoint(q), {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok && res.status !== 404) throw new Error(`Supabase remove failed: ${res.status}`);
  }
}

// ─── Cloudflare R2 (S3-compatible) ──────────────────────────────────────────

export interface R2ProviderOptions {
  /** Public R2 endpoint, e.g. https://<accountid>.r2.cloudflarestorage.com */
  endpoint: string;
  /** Bucket name. */
  bucket: string;
  /** Per-user prefix (e.g. user uuid). All blobs are stored under this. */
  prefix: string;
  /**
   * Pre-signed URL builder. R2 requires SigV4-signed requests; a real app
   * generates pre-signed URLs server-side and passes a builder here.
   */
  signedUrl: (op: 'GET' | 'PUT' | 'DELETE' | 'LIST', key: string) => Promise<string>;
  fetchImpl?: FetchImpl;
}

/**
 * Object-storage provider for Cloudflare R2 / any S3-compatible bucket.
 * Signing is delegated to the host app — usually via a tiny worker that
 * mints pre-signed URLs after authenticating the user.
 *
 * Object layout:
 *   <prefix>/<sessionId>.json   -> EncryptedSessionBlob serialized JSON
 */
export class R2SyncProvider implements SyncProvider {
  readonly id = 'cloudflare-r2';
  private readonly opts: R2ProviderOptions;
  private readonly fetchImpl: FetchImpl;

  constructor(opts: R2ProviderOptions) {
    this.opts = opts;
    this.fetchImpl = opts.fetchImpl ?? defaultFetch();
  }

  private key(sessionId: string): string {
    return `${this.opts.prefix.replace(/\/+$/, '')}/${sessionId}.json`;
  }

  async list(): Promise<string[]> {
    const url = await this.opts.signedUrl('LIST', this.opts.prefix);
    const res = await this.fetchImpl(url, { method: 'GET' });
    if (!res.ok) throw new Error(`R2 list failed: ${res.status}`);
    // ListObjectsV2 returns XML. Parse <Key>prefix/<id>.json</Key>.
    const xml = await res.text();
    const ids: string[] = [];
    const re = /<Key>([^<]+)<\/Key>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const k = m[1];
      const tail = k.split('/').pop() ?? '';
      if (tail.endsWith('.json')) ids.push(tail.slice(0, -'.json'.length));
    }
    return ids;
  }

  async get(sessionId: string): Promise<EncryptedSessionBlob | null> {
    const url = await this.opts.signedUrl('GET', this.key(sessionId));
    const res = await this.fetchImpl(url, { method: 'GET' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`R2 get failed: ${res.status}`);
    const blob = (await res.json()) as EncryptedSessionBlob;
    if (blob.protocolVersion > SYNC_PROTOCOL_VERSION) {
      throw new Error('Encrypted blob uses a newer protocol version');
    }
    return blob;
  }

  async put(blob: EncryptedSessionBlob): Promise<void> {
    const url = await this.opts.signedUrl('PUT', this.key(blob.sessionId));
    const res = await this.fetchImpl(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blob),
    });
    if (!res.ok) throw new Error(`R2 put failed: ${res.status}`);
  }

  async remove(sessionId: string): Promise<void> {
    const url = await this.opts.signedUrl('DELETE', this.key(sessionId));
    const res = await this.fetchImpl(url, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`R2 remove failed: ${res.status}`);
  }
}
