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
  generatePairingCode,
  parsePairingCode,
  selectShareableSessions,
  sealShare,
  openShare,
  SHARE_PROTOCOL_VERSION,
} from '../../src/share';
import { Session } from '../../src/types';

function makeSession(id: string, daysAgo: number): Session {
  const ts = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  return {
    id,
    timestamp: ts,
    durationSeconds: 300,
    rrIntervals: [800, 810],
    rmssd: 42,
    sdnn: 20,
    meanHr: 60,
    pnn50: 10,
    artifactRate: 0,
    verdict: 'moderate',
    perceivedReadiness: null,
    trainingType: null,
    notes: null,
    sleepHours: null,
    sleepQuality: null,
    stressLevel: null,
    source: 'chest_strap',
  };
}

describe('pairing codes', () => {
  it('generates a code with 4-char id and 3 hyphenated words', () => {
    const { bundleId, passphrase } = generatePairingCode();
    expect(bundleId).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    expect(passphrase.split('-')).toHaveLength(3);
  });

  it('round-trips through parsePairingCode', () => {
    const { bundleId, passphrase } = generatePairingCode();
    const parsed = parsePairingCode(`${bundleId}-${passphrase}`);
    expect(parsed?.bundleId).toBe(bundleId);
    expect(parsed?.passphrase).toBe(passphrase);
  });

  it('rejects malformed codes', () => {
    expect(parsePairingCode('not-a-code')).toBeNull();
    expect(parsePairingCode('AB12-singleword')).toBeNull();
    expect(parsePairingCode('')).toBeNull();
  });
});

describe('selectShareableSessions', () => {
  it('keeps only sessions within the lookback window', () => {
    const sessions = [
      makeSession('recent', 1),
      makeSession('older', 31),
      makeSession('boundary', 30),
    ];
    const filtered = selectShareableSessions(sessions, 30);
    expect(filtered.map((s) => s.id).sort()).toEqual(['boundary', 'recent']);
  });

  it('returns empty for non-positive windows', () => {
    expect(selectShareableSessions([makeSession('a', 1)], 0)).toEqual([]);
  });
});

describe('seal + open round trip', () => {
  it('encrypts sessions and a coach can decrypt with the pairing code', async () => {
    const sessions = [makeSession('a', 1), makeSession('b', 2)];
    const sealed = await sealShare(sessions, { athleteName: 'Jose', lookbackDays: 30 });
    const opened = await openShare(sealed.bundle, sealed.pairingCode);
    expect(opened.protocolVersion).toBe(SHARE_PROTOCOL_VERSION);
    expect(opened.sessions.map((s) => s.id).sort()).toEqual(['a', 'b']);
    expect(opened.athleteName).toBe('Jose');
  });

  it('rejects expired bundles', async () => {
    const sealed = await sealShare([makeSession('a', 1)], {
      athleteName: 'Jose',
      ttlDays: 7,
    });
    const future = new Date(Date.now() + 8 * 86_400_000);
    await expect(
      openShare(sealed.bundle, sealed.pairingCode, { now: () => future })
    ).rejects.toThrow(/expired/);
  });

  it('rejects wrong pairing code', async () => {
    const sealed = await sealShare([makeSession('a', 1)], { athleteName: 'Jose' });
    // Same shape, fake passphrase
    const fake = `${sealed.bundle.bundleId}-octopus-river-cycle`;
    if (fake === sealed.pairingCode) return; // extremely unlikely match — skip
    await expect(openShare(sealed.bundle, fake)).rejects.toThrow();
  });

  it('rejects mismatched bundle id', async () => {
    const sealed = await sealShare([makeSession('a', 1)], { athleteName: 'Jose' });
    const wrongCode = `ZZZZ-octopus-river-cycle`;
    await expect(openShare(sealed.bundle, wrongCode)).rejects.toThrow(/match/);
  });

  it('rejects malformed pairing code', async () => {
    const sealed = await sealShare([makeSession('a', 1)], { athleteName: 'Jose' });
    await expect(openShare(sealed.bundle, 'garbage')).rejects.toThrow(/format/);
  });

  it('rejects newer protocol versions', async () => {
    const sealed = await sealShare([makeSession('a', 1)], { athleteName: 'Jose' });
    sealed.bundle.protocolVersion = SHARE_PROTOCOL_VERSION + 5;
    await expect(openShare(sealed.bundle, sealed.pairingCode)).rejects.toThrow(/newer/);
  });
});
