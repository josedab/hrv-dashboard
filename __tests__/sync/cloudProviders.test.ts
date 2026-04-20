jest.mock('expo-crypto', () => {
  const { createHash, randomBytes } = require('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
    digest: async (_alg: string, data: Uint8Array | ArrayBuffer) => {
      const buf =
        data instanceof Uint8Array ? Buffer.from(data) : Buffer.from(new Uint8Array(data));
      const h = createHash('sha256').update(buf).digest();
      return h.buffer.slice(h.byteOffset, h.byteOffset + h.byteLength);
    },
    getRandomBytes: (n: number) => new Uint8Array(randomBytes(n)),
    getRandomBytesAsync: async (n: number) => new Uint8Array(randomBytes(n)),
  };
});

import { SupabaseSyncProvider, R2SyncProvider } from '../../src/sync/cloudProviders';
import { EncryptedSessionBlob } from '../../src/sync';

function fakeResponse(opts: { status?: number; body?: unknown; text?: string } = {}): Response {
  const status = opts.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => opts.body ?? {},
    text: async () => opts.text ?? JSON.stringify(opts.body ?? {}),
  } as Response;
}

const blob: EncryptedSessionBlob = {
  protocolVersion: 1,
  sessionId: 'abc',
  updatedAt: '2026-04-15T07:00:00Z',
  iv: '0011',
  ciphertext: 'aabb',
};

describe('SupabaseSyncProvider', () => {
  it('lists session ids via REST', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return fakeResponse({ body: [{ session_id: 'a' }, { session_id: 'b' }] });
    });
    const p = new SupabaseSyncProvider({
      url: 'https://x.supabase.co',
      anonKey: 'anon',
      accessToken: 'jwt',
      fetchImpl,
    });
    const ids = await p.list();
    expect(ids).toEqual(['a', 'b']);
    expect(calls[0].url).toContain('/rest/v1/hrv_session_blobs');
    expect(calls[0].url).toContain('select=session_id');
  });

  it('returns null on missing get', async () => {
    const fetchImpl = jest.fn(async () => fakeResponse({ body: [] }));
    const p = new SupabaseSyncProvider({
      url: 'https://x.supabase.co',
      anonKey: 'anon',
      accessToken: 'jwt',
      fetchImpl,
    });
    expect(await p.get('missing')).toBeNull();
  });

  it('rebuilds blob from a Supabase row on get', async () => {
    const fetchImpl = jest.fn(async () =>
      fakeResponse({
        body: [
          {
            session_id: 'abc',
            protocol_version: 1,
            updated_at: '2026-04-15T07:00:00Z',
            iv: '0011',
            ciphertext: 'aabb',
          },
        ],
      })
    );
    const p = new SupabaseSyncProvider({
      url: 'https://x.supabase.co',
      anonKey: 'anon',
      accessToken: 'jwt',
      fetchImpl,
    });
    expect(await p.get('abc')).toEqual(blob);
  });

  it('puts as a POST with merge-duplicates', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return fakeResponse({ status: 201 });
    });
    const p = new SupabaseSyncProvider({
      url: 'https://x.supabase.co',
      anonKey: 'anon',
      accessToken: 'jwt',
      fetchImpl,
    });
    await p.put(blob);
    expect(calls[0].init?.method).toBe('POST');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Prefer).toContain('merge-duplicates');
  });

  it('round-trips a v4 blob with salt through put + get without losing the salt', async () => {
    const v4Blob: EncryptedSessionBlob = {
      protocolVersion: 4,
      sessionId: 'v4-test',
      updatedAt: '2026-04-15T07:00:00Z',
      iv: '0011223344556677889900aa',
      ciphertext: 'aabbccdd',
      salt: '00112233445566778899aabbccddeeff',
    };
    let captured: Record<string, unknown> | null = null;
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      // Capture what put() sends, replay it on get().
      if (init?.method === 'POST') {
        captured = JSON.parse(init.body as string);
        return fakeResponse({ status: 201 });
      }
      return fakeResponse({ body: captured ? [captured] : [] });
    });
    const p = new SupabaseSyncProvider({
      url: 'https://x.supabase.co',
      anonKey: 'anon',
      accessToken: 'jwt',
      fetchImpl,
    });
    await p.put(v4Blob);
    expect(captured).toMatchObject({
      protocol_version: 4,
      salt: '00112233445566778899aabbccddeeff',
    });
    const fetched = await p.get('v4-test');
    expect(fetched).toEqual(v4Blob);
  });

  it('treats 404 on remove as success', async () => {
    const fetchImpl = jest.fn(async () => fakeResponse({ status: 404 }));
    const p = new SupabaseSyncProvider({
      url: 'https://x.supabase.co',
      anonKey: 'anon',
      accessToken: 'jwt',
      fetchImpl,
    });
    await expect(p.remove('abc')).resolves.toBeUndefined();
  });

  it('throws on non-404 errors', async () => {
    const fetchImpl = jest.fn(async () => fakeResponse({ status: 500 }));
    const p = new SupabaseSyncProvider({
      url: 'https://x.supabase.co',
      anonKey: 'anon',
      accessToken: 'jwt',
      fetchImpl,
    });
    await expect(p.list()).rejects.toThrow(/500/);
  });

  it('round-trips a v2 blob with its HMAC field intact', async () => {
    // Regression: previously the row mapping dropped `mac`, silently
    // breaking back-compat with v2 blobs already living in Supabase.
    const v2Blob: EncryptedSessionBlob = {
      protocolVersion: 2,
      sessionId: 'legacy',
      updatedAt: '2026-04-15T07:00:00Z',
      iv: 'ab12',
      ciphertext: 'cd34',
      mac: 'deadbeef'.repeat(8),
    };
    const sentRows: unknown[] = [];
    const fetchImpl = jest.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        sentRows.push(JSON.parse(String(init.body)));
        return fakeResponse({ status: 201 });
      }
      return fakeResponse({
        body: [
          {
            session_id: v2Blob.sessionId,
            protocol_version: v2Blob.protocolVersion,
            updated_at: v2Blob.updatedAt,
            iv: v2Blob.iv,
            ciphertext: v2Blob.ciphertext,
            mac: v2Blob.mac,
          },
        ],
      });
    });
    const p = new SupabaseSyncProvider({
      url: 'https://x.supabase.co',
      anonKey: 'anon',
      accessToken: 'jwt',
      fetchImpl,
    });
    await p.put(v2Blob);
    expect((sentRows[0] as { mac?: string }).mac).toBe(v2Blob.mac);
    expect(await p.get('legacy')).toEqual(v2Blob);
  });

  it('writes mac=null for v3 GCM blobs (no separate MAC field)', async () => {
    const v3Blob: EncryptedSessionBlob = {
      protocolVersion: 3,
      sessionId: 'modern',
      updatedAt: '2026-04-15T07:00:00Z',
      iv: 'ab12',
      ciphertext: 'cd34',
    };
    const sentRows: unknown[] = [];
    const fetchImpl = jest.fn(async (_url: string, init?: RequestInit) => {
      sentRows.push(JSON.parse(String(init?.body)));
      return fakeResponse({ status: 201 });
    });
    const p = new SupabaseSyncProvider({
      url: 'https://x.supabase.co',
      anonKey: 'anon',
      accessToken: 'jwt',
      fetchImpl,
    });
    await p.put(v3Blob);
    expect((sentRows[0] as { mac?: string | null }).mac).toBeNull();
  });
});

describe('R2SyncProvider', () => {
  it('parses ListObjectsV2 XML', async () => {
    const xml = `<?xml version="1.0"?>
      <ListBucketResult>
        <Contents><Key>users/u1/abc.json</Key></Contents>
        <Contents><Key>users/u1/def.json</Key></Contents>
        <Contents><Key>users/u1/notajson.txt</Key></Contents>
      </ListBucketResult>`;
    const fetchImpl = jest.fn(async () => fakeResponse({ text: xml }));
    const p = new R2SyncProvider({
      endpoint: 'https://r2.example.com',
      bucket: 'b',
      prefix: 'users/u1',
      signedUrl: async () => 'https://signed.example/list',
      fetchImpl,
    });
    expect(await p.list()).toEqual(['abc', 'def']);
  });

  it('returns null on 404 get', async () => {
    const fetchImpl = jest.fn(async () => fakeResponse({ status: 404 }));
    const p = new R2SyncProvider({
      endpoint: 'https://r2.example.com',
      bucket: 'b',
      prefix: 'users/u1',
      signedUrl: async () => 'https://signed.example/get',
      fetchImpl,
    });
    expect(await p.get('abc')).toBeNull();
  });

  it('puts JSON to a signed url', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return fakeResponse({ status: 200 });
    });
    const p = new R2SyncProvider({
      endpoint: 'https://r2.example.com',
      bucket: 'b',
      prefix: 'users/u1',
      signedUrl: async (op, key) => `https://signed.example/${op}/${key}`,
      fetchImpl,
    });
    await p.put(blob);
    expect(calls[0].init?.method).toBe('PUT');
    expect(calls[0].url).toContain('PUT');
    expect(calls[0].url).toContain('users/u1/abc.json');
  });

  it('rejects newer protocol blobs from remote', async () => {
    const newer = { ...blob, protocolVersion: 99 };
    const fetchImpl = jest.fn(async () => fakeResponse({ body: newer }));
    const p = new R2SyncProvider({
      endpoint: 'https://r2.example.com',
      bucket: 'b',
      prefix: 'users/u1',
      signedUrl: async () => 'https://signed.example/get',
      fetchImpl,
    });
    await expect(p.get('abc')).rejects.toThrow(/newer protocol/);
  });
});
