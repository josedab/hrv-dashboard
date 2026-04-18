jest.mock('expo-crypto', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require('crypto');
  return {
    getRandomBytesAsync: jest.fn(async (n: number) => {
      // Deterministic, non-zero bytes for assertions in tests.
      const out = new Uint8Array(n);
      for (let i = 0; i < n; i++) out[i] = (i * 7 + 1) & 0xff;
      return out;
    }),
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digest: jest.fn(async (_alg: string, data: Uint8Array) => {
      const hash = nodeCrypto.createHash('sha256');
      hash.update(Buffer.from(data));
      return hash.digest('hex');
    }),
  };
});

import {
  arrayToHex,
  hexToArray,
  getRandomBytes,
  hmacSha256,
  constantTimeEqual,
} from '../../src/utils/encoding';

describe('arrayToHex / hexToArray', () => {
  it('round-trips an arbitrary byte sequence', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x7f, 0x80, 0xff, 0xab, 0xcd]);
    expect(hexToArray(arrayToHex(bytes))).toEqual(bytes);
  });

  it('encodes empty input as empty string', () => {
    expect(arrayToHex(new Uint8Array(0))).toBe('');
  });

  it('decodes empty string as empty array', () => {
    expect(hexToArray('')).toEqual(new Uint8Array(0));
  });

  it('uses zero-padded lower-case hex', () => {
    expect(arrayToHex(new Uint8Array([0x0a, 0xff, 0x10]))).toBe('0aff10');
  });
});

describe('getRandomBytes', () => {
  it('returns a Uint8Array of the requested length', async () => {
    const out = await getRandomBytes(16);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBe(16);
  });

  it('returns an empty array when length is 0', async () => {
    const out = await getRandomBytes(0);
    expect(out.length).toBe(0);
  });

  it('rejects negative or non-finite lengths', async () => {
    await expect(getRandomBytes(-1)).rejects.toThrow('Invalid random byte length');
    await expect(getRandomBytes(Number.NaN)).rejects.toThrow('Invalid random byte length');
    await expect(getRandomBytes(Number.POSITIVE_INFINITY)).rejects.toThrow(
      'Invalid random byte length'
    );
  });
});

describe('hmacSha256 (RFC 4231 vectors)', () => {
  // Test Case 1
  it('matches RFC 4231 test case 1', async () => {
    const key = new Uint8Array(20).fill(0x0b);
    const enc = new TextEncoder();
    const message = enc.encode('Hi There');
    const mac = await hmacSha256(key, message);
    expect(arrayToHex(mac)).toBe(
      'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7'
    );
  });

  // Test Case 2 — key shorter than block size, ASCII content
  it('matches RFC 4231 test case 2', async () => {
    const enc = new TextEncoder();
    const key = enc.encode('Jefe');
    const message = enc.encode('what do ya want for nothing?');
    const mac = await hmacSha256(key, message);
    expect(arrayToHex(mac)).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'
    );
  });

  // Test Case 4 — key longer than 20 bytes (still < block size)
  it('matches RFC 4231 test case 4', async () => {
    const key = new Uint8Array(25);
    for (let i = 0; i < key.length; i++) key[i] = i + 1;
    const message = new Uint8Array(50).fill(0xcd);
    const mac = await hmacSha256(key, message);
    expect(arrayToHex(mac)).toBe(
      '82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b'
    );
  });

  // Key longer than block size triggers the "hash the key first" branch
  it('handles keys longer than the SHA-256 block size', async () => {
    const key = new Uint8Array(131).fill(0xaa);
    const enc = new TextEncoder();
    const message = enc.encode('Test Using Larger Than Block-Size Key - Hash Key First');
    const mac = await hmacSha256(key, message);
    expect(arrayToHex(mac)).toBe(
      '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54'
    );
  });
});

describe('constantTimeEqual', () => {
  it('returns true for identical arrays', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(constantTimeEqual(a, b)).toBe(true);
  });

  it('returns false for arrays with different content of same length', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 5]);
    expect(constantTimeEqual(a, b)).toBe(false);
  });

  it('returns false for arrays of different lengths', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(constantTimeEqual(a, b)).toBe(false);
  });

  it('returns true for two empty arrays', () => {
    expect(constantTimeEqual(new Uint8Array(0), new Uint8Array(0))).toBe(true);
  });
});
