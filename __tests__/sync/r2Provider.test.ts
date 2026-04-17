jest.mock('expo-crypto', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digest: async (_alg: string, data: Uint8Array) => {
      const h = crypto.createHash('sha256');
      h.update(Buffer.from(data));
      return new Uint8Array(h.digest());
    },
    getRandomBytesAsync: async (n: number) => new Uint8Array(crypto.randomBytes(n)),
  };
});

import { R2Provider, deriveStrongKey, generateUserSalt } from '../../src/sync/r2Provider';
import { EncryptedSessionBlob, SYNC_PROTOCOL_VERSION } from '../../src/sync';

class FakePresigner {
  storage = new Map<string, string>();
  async resolve(_method: string, key: string) {
    return `https://r2.fake/${encodeURIComponent(key)}`;
  }
  async list() {
    return Array.from(this.storage.keys());
  }
}

function makeFetch(presigner: FakePresigner) {
  return jest.fn(async (input: string, init?: RequestInit) => {
    const key = decodeURIComponent(input.replace('https://r2.fake/', ''));
    const method = init?.method ?? 'GET';
    if (method === 'PUT') {
      presigner.storage.set(key, init!.body as string);
      return new Response('', { status: 200 });
    }
    if (method === 'DELETE') {
      presigner.storage.delete(key);
      return new Response('', { status: 200 });
    }
    const v = presigner.storage.get(key);
    if (!v) return new Response('', { status: 404 });
    return new Response(v, { status: 200 });
  }) as unknown as typeof fetch;
}

function makeBlob(id: string): EncryptedSessionBlob {
  return {
    protocolVersion: SYNC_PROTOCOL_VERSION,
    sessionId: id,
    updatedAt: '2026-04-15T08:00:00Z',
    iv: 'aabbcc',
    ciphertext: 'deadbeef',
  };
}

describe('R2Provider', () => {
  it('round-trips a blob through PUT → GET → DELETE', async () => {
    const presigner = new FakePresigner();
    const provider = new R2Provider({
      bucketName: 'test',
      presigner,
      fetchImpl: makeFetch(presigner),
    });
    await provider.put(makeBlob('s1'));
    expect(await provider.list()).toEqual(['s1']);
    const got = await provider.get('s1');
    expect(got?.sessionId).toBe('s1');
    await provider.remove('s1');
    expect(await provider.list()).toEqual([]);
    expect(await provider.get('s1')).toBeNull();
  });
});

describe('strong KDF', () => {
  it('derives deterministically and produces 64 hex chars', async () => {
    const salt = 'a'.repeat(64);
    const k1 = await deriveStrongKey('passphrase', salt, 'sess-1');
    const k2 = await deriveStrongKey('passphrase', salt, 'sess-1');
    expect(k1).toBe(k2);
    expect(k1).toHaveLength(64);
  });

  it('different context → different key', async () => {
    const salt = 'b'.repeat(64);
    const k1 = await deriveStrongKey('p', salt, 'a');
    const k2 = await deriveStrongKey('p', salt, 'b');
    expect(k1).not.toBe(k2);
  });

  it('generateUserSalt returns 64 hex chars', async () => {
    const s = await generateUserSalt();
    expect(s).toHaveLength(64);
    expect(s).toMatch(/^[0-9a-f]+$/);
  });
});
