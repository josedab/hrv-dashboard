/**
 * Test-only shim for `@noble/hashes/scrypt`.
 *
 * The real package is pure ESM; ts-jest does not transform `node_modules`
 * out of the box. We map this file in place via jest.moduleNameMapper
 * so unit tests can exercise the production scrypt KDF without bringing
 * in a babel-jest pipeline. Semantically identical (RFC-7914 scrypt).
 *
 * IMPORTANT: this file lives in `test-utils/` (NOT `__tests__/`) so jest
 * does not try to execute it as a test suite.
 */
import { scryptSync } from 'crypto';

interface ScryptParams {
  N: number;
  r: number;
  p: number;
  dkLen: number;
}

export function scrypt(
  password: Uint8Array,
  salt: Uint8Array,
  params: ScryptParams
): Uint8Array {
  // Node's scrypt requires maxmem >= ~128 * N * r * p, so set generously.
  const maxmem = 256 * params.N * params.r * params.p;
  const out = scryptSync(Buffer.from(password), Buffer.from(salt), params.dkLen, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem,
  });
  return new Uint8Array(out);
}

export async function scryptAsync(
  password: Uint8Array,
  salt: Uint8Array,
  params: ScryptParams
): Promise<Uint8Array> {
  return scrypt(password, salt, params);
}
