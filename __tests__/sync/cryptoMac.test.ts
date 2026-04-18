jest.mock('expo-crypto', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
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

import { encryptString, decryptString, EncryptedString } from '../../src/sync/crypto';

const passphrase = 'correct horse battery staple';
const context = 'session-id-123';
const plaintext = JSON.stringify({ hello: 'world', n: 42 });

describe('sync crypto v4 (AES-256-GCM + scrypt KDF)', () => {
  it('encryptString emits v4 by default with salt, empty mac, and tag-bearing ciphertext', async () => {
    const enc = await encryptString(plaintext, passphrase, context);
    expect(enc.version).toBe(4);
    expect(enc.mac).toBe('');
    expect(enc.salt).toMatch(/^[0-9a-f]{32}$/); // 16-byte salt
    expect(enc.iv).toMatch(/^[0-9a-f]{24}$/); // 12-byte IV
    // ciphertext = plaintext bytes + 16-byte tag, hex-encoded
    const expectedHexLen = (Buffer.byteLength(plaintext, 'utf8') + 16) * 2;
    expect(enc.ciphertext.length).toBe(expectedHexLen);
  });

  it('roundtrips v4 to the same plaintext', async () => {
    const enc = await encryptString(plaintext, passphrase, context);
    const out = await decryptString(
      enc.ciphertext,
      passphrase,
      context,
      enc.iv,
      enc.mac,
      enc.version,
      enc.salt
    );
    expect(out).toBe(plaintext);
  });

  it('rejects ciphertext mutation under v4 (GCM tag check)', async () => {
    const enc = await encryptString(plaintext, passphrase, context);
    const bytes = Buffer.from(enc.ciphertext, 'hex');
    bytes[0] ^= 0x01;
    await expect(
      decryptString(bytes.toString('hex'), passphrase, context, enc.iv, '', enc.version, enc.salt)
    ).rejects.toThrow(/Authentication failed/);
  });

  it('rejects iv mutation under v4', async () => {
    const enc = await encryptString(plaintext, passphrase, context);
    const ivBytes = Buffer.from(enc.iv, 'hex');
    ivBytes[0] ^= 0x01;
    await expect(
      decryptString(
        enc.ciphertext,
        passphrase,
        context,
        ivBytes.toString('hex'),
        '',
        enc.version,
        enc.salt
      )
    ).rejects.toThrow(/Authentication failed/);
  });

  it('rejects salt mutation under v4 (derives different key)', async () => {
    const enc = await encryptString(plaintext, passphrase, context);
    const saltBytes = Buffer.from(enc.salt!, 'hex');
    saltBytes[0] ^= 0x01;
    await expect(
      decryptString(
        enc.ciphertext,
        passphrase,
        context,
        enc.iv,
        '',
        enc.version,
        saltBytes.toString('hex')
      )
    ).rejects.toThrow(/Authentication failed/);
  });

  it('rejects v4 blob with missing salt', async () => {
    const enc = await encryptString(plaintext, passphrase, context);
    await expect(
      decryptString(enc.ciphertext, passphrase, context, enc.iv, '', enc.version)
    ).rejects.toThrow(/missing required salt/);
  });

  it('rejects wrong passphrase under v4', async () => {
    const enc = await encryptString(plaintext, passphrase, context);
    await expect(
      decryptString(enc.ciphertext, 'wrong', context, enc.iv, '', enc.version, enc.salt)
    ).rejects.toThrow(/Authentication failed/);
  });
});

describe('sync crypto v2 (legacy HMAC) — backwards compatibility', () => {
  /**
   * Build a v2-style blob the same way the previous implementation did,
   * so we can verify v2 readers still work after the v3 cutover.
   */
  async function encryptV2Legacy(pt: string, pass: string, ctx: string): Promise<EncryptedString> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createHash, randomBytes } = require('crypto');
    const sha = (b: Uint8Array) =>
      new Uint8Array(createHash('sha256').update(Buffer.from(b)).digest());
    const enc = new TextEncoder();
    let key = enc.encode(`${pass}:${ctx}`);
    for (let i = 0; i < 10_000; i++) key = sha(key);
    let macKey = sha(enc.encode(`mac:${pass}:${ctx}`));
    for (let i = 0; i < 256; i++) macKey = sha(macKey);
    const iv = new Uint8Array(randomBytes(12));
    const data = enc.encode(pt);
    const ct = new Uint8Array(data.length);
    const blockSize = 32;
    for (let off = 0; off < data.length; off += blockSize) {
      const counter = new Uint8Array(4);
      const n = Math.floor(off / blockSize);
      counter[0] = (n >> 24) & 0xff;
      counter[1] = (n >> 16) & 0xff;
      counter[2] = (n >> 8) & 0xff;
      counter[3] = n & 0xff;
      const ks = sha(new Uint8Array([...key, ...iv, ...counter]));
      const end = Math.min(off + blockSize, data.length);
      for (let i = off; i < end; i++) ct[i] = data[i] ^ ks[i - off];
    }
    // HMAC-SHA-256
    const block = 64;
    let k = macKey;
    if (k.length > block) k = sha(k);
    if (k.length < block) {
      const padded = new Uint8Array(block);
      padded.set(k);
      k = padded;
    }
    const okp = new Uint8Array(block);
    const ikp = new Uint8Array(block);
    for (let i = 0; i < block; i++) {
      okp[i] = k[i] ^ 0x5c;
      ikp[i] = k[i] ^ 0x36;
    }
    const macInput = new Uint8Array(iv.length + ct.length);
    macInput.set(iv);
    macInput.set(ct, iv.length);
    const inner = sha(new Uint8Array([...ikp, ...macInput]));
    const mac = sha(new Uint8Array([...okp, ...inner]));
    const toHex = (u: Uint8Array) =>
      Array.from(u)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    return { ciphertext: toHex(ct), iv: toHex(iv), mac: toHex(mac) };
  }

  it('decrypts a v2 blob (mac present, no version)', async () => {
    const v2 = await encryptV2Legacy(plaintext, passphrase, context);
    const out = await decryptString(v2.ciphertext, passphrase, context, v2.iv, v2.mac);
    expect(out).toBe(plaintext);
  });

  it('rejects v2 ciphertext mutation when mac is provided', async () => {
    const v2 = await encryptV2Legacy(plaintext, passphrase, context);
    const bytes = Buffer.from(v2.ciphertext, 'hex');
    bytes[0] ^= 0x01;
    await expect(
      decryptString(bytes.toString('hex'), passphrase, context, v2.iv, v2.mac)
    ).rejects.toThrow(/Authentication failed/);
  });

  it('decrypts a v1 blob (no mac, no version) for legacy compatibility', async () => {
    const v2 = await encryptV2Legacy(plaintext, passphrase, context);
    // Drop the mac to simulate v1 storage.
    const out = await decryptString(v2.ciphertext, passphrase, context, v2.iv);
    expect(out).toBe(plaintext);
  });
});

describe('sync crypto v3 (AES-GCM + iterated SHA-256) — backwards compatibility', () => {
  /**
   * Build a v3-style blob the same way the previous implementation did
   * (iterated SHA-256 KDF, no salt field), so a v4 client still reads
   * cloud copies that were written by older app versions.
   */
  async function encryptV3Legacy(pt: string, pass: string, ctx: string): Promise<EncryptedString> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createHash, randomBytes, createCipheriv } = require('crypto');
    const sha = (b: Uint8Array) =>
      new Uint8Array(createHash('sha256').update(Buffer.from(b)).digest());
    const enc = new TextEncoder();
    let key = enc.encode(`${pass}:${ctx}`);
    for (let i = 0; i < 10_000; i++) key = sha(key);
    const aesKey = key.slice(0, 32);
    const iv = new Uint8Array(randomBytes(12));
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(aesKey), Buffer.from(iv));
    const data = enc.encode(pt);
    const ctRaw = Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()]);
    const tag = cipher.getAuthTag();
    const ct = new Uint8Array(ctRaw.length + tag.length);
    ct.set(new Uint8Array(ctRaw), 0);
    ct.set(new Uint8Array(tag), ctRaw.length);
    const toHex = (u: Uint8Array) =>
      Array.from(u)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    return { ciphertext: toHex(ct), iv: toHex(iv), mac: '', version: 3 };
  }

  it('decrypts a v3 blob (no salt, version=3) written by an older client', async () => {
    const v3 = await encryptV3Legacy(plaintext, passphrase, context);
    const out = await decryptString(v3.ciphertext, passphrase, context, v3.iv, '', 3);
    expect(out).toBe(plaintext);
  });

  it('rejects v3 ciphertext mutation (GCM tag check)', async () => {
    const v3 = await encryptV3Legacy(plaintext, passphrase, context);
    const bytes = Buffer.from(v3.ciphertext, 'hex');
    bytes[0] ^= 0x01;
    await expect(
      decryptString(bytes.toString('hex'), passphrase, context, v3.iv, '', 3)
    ).rejects.toThrow(/Authentication failed/);
  });
});
