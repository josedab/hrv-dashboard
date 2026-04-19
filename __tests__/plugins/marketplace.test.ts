jest.mock('expo-crypto', () => {
  const { createHash } = require('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
    digest: async (_alg: string, data: Uint8Array | ArrayBuffer) => {
      const buf =
        data instanceof Uint8Array ? Buffer.from(data) : Buffer.from(new Uint8Array(data));
      const h = createHash('sha256').update(buf).digest();
      return h.buffer.slice(h.byteOffset, h.byteOffset + h.byteLength);
    },
  };
});

import { createHash } from 'crypto';
import {
  validateCatalog,
  verifyCatalogEntry,
  installPlugin,
  installPluginFromJson,
  uninstallPlugin,
  loadInstalledPlugins,
  InMemoryPluginStorage,
  CATALOG_SCHEMA_VERSION,
  PluginCatalogEntry,
} from '../../src/plugins/marketplace';

function fingerprintOf(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

function makeEntry(id: string, source: string): PluginCatalogEntry {
  return {
    manifest: { id, name: id, version: '1.0', permissions: ['read:session'] },
    source,
    fingerprint: fingerprintOf(source),
  };
}

const VALID_SOURCE = 'function compute(s){return {metrics:{x:s.rmssd}}}';

describe('verifyCatalogEntry', () => {
  it('passes when fingerprint matches', async () => {
    expect(await verifyCatalogEntry(makeEntry('a', VALID_SOURCE))).toBe(true);
  });

  it('fails when fingerprint mismatches', async () => {
    const entry = makeEntry('a', VALID_SOURCE);
    entry.fingerprint = 'deadbeef';
    expect(await verifyCatalogEntry(entry)).toBe(false);
  });
});

describe('validateCatalog', () => {
  it('accepts a valid catalog', async () => {
    const result = await validateCatalog({
      schemaVersion: CATALOG_SCHEMA_VERSION,
      publishedAt: '2026-01-01T00:00:00Z',
      entries: [makeEntry('a', VALID_SOURCE)],
    });
    expect(result.ok).toBe(true);
  });

  it('flags duplicate ids', async () => {
    const result = await validateCatalog({
      schemaVersion: CATALOG_SCHEMA_VERSION,
      publishedAt: '2026-01-01T00:00:00Z',
      entries: [makeEntry('a', VALID_SOURCE), makeEntry('a', VALID_SOURCE)],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate'))).toBe(true);
  });

  it('flags fingerprint mismatch', async () => {
    const entry = makeEntry('a', VALID_SOURCE);
    entry.fingerprint = 'wrong';
    const result = await validateCatalog({
      schemaVersion: CATALOG_SCHEMA_VERSION,
      publishedAt: '2026-01-01T00:00:00Z',
      entries: [entry],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects newer schema versions', async () => {
    const result = await validateCatalog({
      schemaVersion: CATALOG_SCHEMA_VERSION + 1,
      publishedAt: '2026-01-01T00:00:00Z',
      entries: [],
    });
    expect(result.ok).toBe(false);
  });
});

describe('install / uninstall', () => {
  it('persists an installed plugin', async () => {
    const storage = new InMemoryPluginStorage();
    const installed = await installPlugin(makeEntry('a', VALID_SOURCE), storage);
    expect(installed.id).toBe('a');
    expect(await storage.list()).toHaveLength(1);
  });

  it('rejects on fingerprint mismatch', async () => {
    const storage = new InMemoryPluginStorage();
    const entry = makeEntry('a', VALID_SOURCE);
    entry.fingerprint = 'xxx';
    await expect(installPlugin(entry, storage)).rejects.toThrow(/fingerprint/);
  });

  it('rejects unsafe source via static audit', async () => {
    const storage = new InMemoryPluginStorage();
    const bad = makeEntry('a', 'eval("hack")');
    await expect(installPlugin(bad, storage)).rejects.toThrow();
  });

  it('uninstall removes the entry', async () => {
    const storage = new InMemoryPluginStorage();
    await installPlugin(makeEntry('a', VALID_SOURCE), storage);
    await uninstallPlugin('a', storage);
    expect(await storage.list()).toHaveLength(0);
  });
});

describe('loadInstalledPlugins', () => {
  it('compiles all installed plugins', async () => {
    const storage = new InMemoryPluginStorage();
    await installPlugin(makeEntry('a', VALID_SOURCE), storage);
    await installPlugin(makeEntry('b', VALID_SOURCE), storage);
    const { plugins, failures } = await loadInstalledPlugins(storage);
    expect(plugins).toHaveLength(2);
    expect(failures).toHaveLength(0);
  });

  it('reports failures without aborting', async () => {
    const storage = new InMemoryPluginStorage();
    await storage.upsert({
      id: 'broken',
      version: '1',
      fingerprint: 'x',
      installedAt: '2026-01-01T00:00:00Z',
      source: 'eval("x")',
      manifest: { id: 'broken', name: 'broken', version: '1', permissions: ['read:session'] },
    });
    await installPlugin(makeEntry('good', VALID_SOURCE), storage);
    const { plugins, failures } = await loadInstalledPlugins(storage);
    expect(plugins).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].id).toBe('broken');
  });
});

describe('installPluginFromJson', () => {
  const VALID = JSON.stringify({
    manifest: {
      id: 'pasted',
      name: 'Pasted',
      version: '0.1.0',
      permissions: ['read:session'],
    },
    source: 'function compute(s){return {metrics:{x:s.rmssd}}}',
  });

  it('installs a pasted plugin and auto-computes the fingerprint when omitted', async () => {
    const storage = new InMemoryPluginStorage();
    const installed = await installPluginFromJson(VALID, storage);
    expect(installed.id).toBe('pasted');
    expect(installed.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    const list = await storage.list();
    expect(list).toHaveLength(1);
  });

  it('rejects empty input', async () => {
    const storage = new InMemoryPluginStorage();
    await expect(installPluginFromJson('   ', storage)).rejects.toThrow(/Paste a plugin/);
  });

  it('rejects malformed JSON with a clear message', async () => {
    const storage = new InMemoryPluginStorage();
    await expect(installPluginFromJson('not json', storage)).rejects.toThrow(/Invalid JSON/);
  });

  it('rejects missing manifest fields', async () => {
    const storage = new InMemoryPluginStorage();
    await expect(
      installPluginFromJson(
        JSON.stringify({ manifest: {}, source: 'function compute(){}' }),
        storage
      )
    ).rejects.toThrow(/id, name, and version/);
  });

  it('rejects missing source', async () => {
    const storage = new InMemoryPluginStorage();
    await expect(
      installPluginFromJson(
        JSON.stringify({
          manifest: { id: 'x', name: 'x', version: '1', permissions: ['read:session'] },
        }),
        storage
      )
    ).rejects.toThrow(/Missing `source`/);
  });

  it('honors a user-supplied fingerprint and rejects mismatches', async () => {
    const storage = new InMemoryPluginStorage();
    await expect(
      installPluginFromJson(
        JSON.stringify({
          manifest: { id: 'pasted', name: 'P', version: '1', permissions: ['read:session'] },
          source: 'function compute(s){return {metrics:{x:s.rmssd}}}',
          fingerprint: '0'.repeat(64),
        }),
        storage
      )
    ).rejects.toThrow(/fingerprint mismatch/);
  });

  it('rejects sources that fail static audit', async () => {
    const storage = new InMemoryPluginStorage();
    await expect(
      installPluginFromJson(
        JSON.stringify({
          manifest: { id: 'bad', name: 'bad', version: '1', permissions: ['read:session'] },
          source: 'function compute(){eval("x")}',
        }),
        storage
      )
    ).rejects.toThrow();
  });
});
