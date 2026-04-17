/**
 * Plugin marketplace registry.
 *
 * Manages a catalog of installable plugins (manifest + source) plus a
 * persistent installed-list stored in the SQLite settings table.
 *
 * The catalog itself is a {@link PluginCatalog} — typically fetched from
 * a static JSON file the maintainer hosts (e.g. github raw URL). Each
 * entry includes a fingerprint (sha256 of the source) so the install
 * step can detect tampering versus the published version.
 */
import * as Crypto from 'expo-crypto';
import { CompiledPlugin, PluginManifest, compilePlugin } from './host';

export interface PluginCatalogEntry {
  manifest: PluginManifest;
  /** Plain JS source for the plugin compute function. */
  source: string;
  /** SHA-256 of the source, hex. Verified on install. */
  fingerprint: string;
  /** Optional human-readable changelog snippet. */
  changelog?: string;
}

export interface PluginCatalog {
  schemaVersion: number;
  publishedAt: string;
  entries: PluginCatalogEntry[];
}

export const CATALOG_SCHEMA_VERSION = 1;

/** Persistent record stored in settings under `plugin_installed:<id>`. */
export interface InstalledPlugin {
  id: string;
  version: string;
  fingerprint: string;
  installedAt: string;
  source: string;
  manifest: PluginManifest;
}

export interface PluginStorage {
  list(): Promise<InstalledPlugin[]>;
  upsert(entry: InstalledPlugin): Promise<void>;
  remove(id: string): Promise<void>;
}

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, enc.encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Verifies a catalog entry's declared fingerprint matches its source. */
export async function verifyCatalogEntry(entry: PluginCatalogEntry): Promise<boolean> {
  const actual = await sha256Hex(entry.source);
  return actual.toLowerCase() === entry.fingerprint.toLowerCase();
}

/** Validates a catalog document end-to-end. */
export async function validateCatalog(
  catalog: PluginCatalog
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  if (!catalog || typeof catalog !== 'object') {
    return { ok: false, errors: ['Catalog must be an object'] };
  }
  if (catalog.schemaVersion > CATALOG_SCHEMA_VERSION) {
    errors.push(`Catalog uses a newer schema version (${catalog.schemaVersion})`);
  }
  if (!Array.isArray(catalog.entries)) {
    errors.push('Catalog.entries must be an array');
    return { ok: false, errors };
  }
  const seen = new Set<string>();
  for (const entry of catalog.entries) {
    const id = entry.manifest?.id ?? '<missing>';
    if (seen.has(id)) errors.push(`Duplicate plugin id: ${id}`);
    seen.add(id);
    if (!entry.source) errors.push(`Plugin ${id}: missing source`);
    if (!entry.fingerprint) errors.push(`Plugin ${id}: missing fingerprint`);
    if (entry.source && entry.fingerprint) {
      const ok = await verifyCatalogEntry(entry);
      if (!ok) errors.push(`Plugin ${id}: fingerprint mismatch`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Install a plugin into local storage. Compiles it once to surface any
 * errors before persisting.
 */
export async function installPlugin(
  entry: PluginCatalogEntry,
  storage: PluginStorage,
  now: () => Date = () => new Date()
): Promise<InstalledPlugin> {
  const verified = await verifyCatalogEntry(entry);
  if (!verified) throw new Error(`Plugin ${entry.manifest.id}: fingerprint mismatch`);
  // Throws if the plugin fails static audit or doesn't expose `compute`.
  compilePlugin(entry.manifest, entry.source);
  const installed: InstalledPlugin = {
    id: entry.manifest.id,
    version: entry.manifest.version,
    fingerprint: entry.fingerprint,
    installedAt: now().toISOString(),
    source: entry.source,
    manifest: entry.manifest,
  };
  await storage.upsert(installed);
  return installed;
}

export async function uninstallPlugin(id: string, storage: PluginStorage): Promise<void> {
  await storage.remove(id);
}

/** Recompiles all installed plugins, dropping any that fail to compile. */
export async function loadInstalledPlugins(storage: PluginStorage): Promise<{
  plugins: CompiledPlugin[];
  failures: { id: string; reason: string }[];
}> {
  const installed = await storage.list();
  const plugins: CompiledPlugin[] = [];
  const failures: { id: string; reason: string }[] = [];
  for (const entry of installed) {
    try {
      plugins.push(compilePlugin(entry.manifest, entry.source));
    } catch (err) {
      failures.push({ id: entry.id, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return { plugins, failures };
}

/** In-memory storage for tests. */
export class InMemoryPluginStorage implements PluginStorage {
  private map = new Map<string, InstalledPlugin>();

  async list(): Promise<InstalledPlugin[]> {
    return [...this.map.values()];
  }
  async upsert(entry: InstalledPlugin): Promise<void> {
    this.map.set(entry.id, entry);
  }
  async remove(id: string): Promise<void> {
    this.map.delete(id);
  }
}
