jest.mock('expo-crypto', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHash, randomBytes } = require('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
    digest: async (_alg: string, data: Uint8Array | ArrayBuffer) => {
      const buf = data instanceof Uint8Array
        ? Buffer.from(data)
        : Buffer.from(new Uint8Array(data));
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
