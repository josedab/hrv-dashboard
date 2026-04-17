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

import {
  encryptSessionBlob,
  decryptSessionBlob,
  resolveConflict,
  runSync,
  SYNC_PROTOCOL_VERSION,
} from '../../src/sync';
import { InMemorySyncProvider } from '../../src/sync/inMemoryProvider';
import { Session } from '../../src/types';

function makeSession(id: string, rmssd = 42): Session {
  return {
    id,
    timestamp: '2026-04-15T06:30:00Z',
    durationSeconds: 300,
    rrIntervals: [800, 820, 810],
    rmssd,
    sdnn: 20,
    meanHr: 60,
    pnn50: 15,
    artifactRate: 0,
    verdict: 'moderate',
    perceivedReadiness: 4,
    trainingType: 'Cycling',
    notes: 'felt fine',
    sleepHours: 7.5,
    sleepQuality: 4,
    stressLevel: 2,
    source: 'chest_strap',
  };
}

describe('sync crypto', () => {
  it('round-trips a session through encrypt/decrypt with the same passphrase', async () => {
    const session = makeSession('a');
    const blob = await encryptSessionBlob(session, 'pass-1234', '2026-04-15T07:00:00Z');
    expect(blob.protocolVersion).toBe(SYNC_PROTOCOL_VERSION);
    expect(blob.sessionId).toBe('a');
    expect(blob.ciphertext).not.toContain('felt fine');
    const restored = await decryptSessionBlob(blob, 'pass-1234');
    expect(restored).toEqual(session);
  });

  it('fails to decrypt with the wrong passphrase', async () => {
    const blob = await encryptSessionBlob(makeSession('a'), 'right-pass', '2026-04-15T07:00:00Z');
    await expect(decryptSessionBlob(blob, 'wrong-pass')).rejects.toThrow();
  });

  it('rejects newer protocol versions', async () => {
    const blob = await encryptSessionBlob(makeSession('a'), 'p', '2026-04-15T07:00:00Z');
    blob.protocolVersion = SYNC_PROTOCOL_VERSION + 1;
    await expect(decryptSessionBlob(blob, 'p')).rejects.toThrow(/newer/);
  });
});

describe('resolveConflict', () => {
  it('prefers the newer remote', () => {
    const winner = resolveConflict(
      { session: makeSession('a'), updatedAt: '2026-04-15T06:00:00Z' },
      {
        blob: {
          protocolVersion: 1,
          sessionId: 'a',
          updatedAt: '2026-04-15T07:00:00Z',
          iv: '',
          ciphertext: '',
        },
      }
    );
    expect(winner).toBe('remote');
  });

  it('keeps local on tie', () => {
    const ts = '2026-04-15T06:00:00Z';
    const winner = resolveConflict(
      { session: makeSession('a'), updatedAt: ts },
      { blob: { protocolVersion: 1, sessionId: 'a', updatedAt: ts, iv: '', ciphertext: '' } }
    );
    expect(winner).toBe('local');
  });
});

describe('runSync', () => {
  it('uploads local-only sessions to the provider', async () => {
    const provider = new InMemorySyncProvider();
    const local = [{ session: makeSession('a'), updatedAt: '2026-04-15T07:00:00Z' }];
    const upserts: Session[] = [];
    const result = await runSync({
      passphrase: 'pp-12345',
      provider,
      loadLocal: async () => local,
      upsertLocal: async (s) => {
        upserts.push(s);
      },
    });
    expect(result.uploaded).toBe(1);
    expect(provider.size()).toBe(1);
    expect(upserts).toHaveLength(0);
  });

  it('downloads remote-only sessions', async () => {
    const provider = new InMemorySyncProvider();
    const blob = await encryptSessionBlob(
      makeSession('remote-1'),
      'pp-12345',
      '2026-04-15T07:00:00Z'
    );
    await provider.put(blob);

    const upserts: Session[] = [];
    const result = await runSync({
      passphrase: 'pp-12345',
      provider,
      loadLocal: async () => [],
      upsertLocal: async (s) => {
        upserts.push(s);
      },
    });
    expect(result.downloaded).toBe(1);
    expect(upserts[0].id).toBe('remote-1');
  });

  it('reconciles a conflict by taking the newer side', async () => {
    const provider = new InMemorySyncProvider();
    const remoteBlob = await encryptSessionBlob(
      makeSession('id-1', 99),
      'pp',
      '2026-04-15T08:00:00Z'
    );
    await provider.put(remoteBlob);

    const local = [{ session: makeSession('id-1', 42), updatedAt: '2026-04-15T06:00:00Z' }];
    const upserts: Session[] = [];
    const result = await runSync({
      passphrase: 'pp',
      provider,
      loadLocal: async () => local,
      upsertLocal: async (s) => {
        upserts.push(s);
      },
    });
    expect(result.conflictsResolved).toBe(1);
    expect(upserts[0].rmssd).toBe(99);
  });

  it('captures decryption errors per blob without aborting', async () => {
    const provider = new InMemorySyncProvider();
    const goodBlob = await encryptSessionBlob(makeSession('good'), 'right', '2026-04-15T08:00:00Z');
    const badBlob = await encryptSessionBlob(makeSession('bad'), 'wrong', '2026-04-15T08:00:00Z');
    await provider.put(goodBlob);
    await provider.put(badBlob);

    const result = await runSync({
      passphrase: 'right',
      provider,
      loadLocal: async () => [],
      upsertLocal: async () => {},
    });
    expect(result.downloaded).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].sessionId).toBe('bad');
  });
});
