---
sidebar_position: 7
---

# Plugins API

API reference for the sandboxed plugin execution engine, marketplace, and Open HRV Protocol.

## Plugin Host

**Module:** `src/plugins/host.ts`

### compilePlugin

Compiles and sandboxes a JavaScript plugin with safety checks.

```typescript
compilePlugin(
  manifest: PluginManifest,
  source: string,
  opts?: { timeoutMs?: number }
): CompiledPlugin
```

**Parameters:**
- `manifest` — Plugin metadata (id, name, version, permissions)
- `source` — JavaScript source code
- `opts.timeoutMs` — Execution timeout (default: 250ms)

**Behavior:**
- Runs `staticAuditPluginSource()` to reject forbidden tokens
- Wraps source in a sandboxed scope (no `globalThis`, `fetch`, `eval`, `require`)
- Returns a `CompiledPlugin` with a `compute()` method

### staticAuditPluginSource

Scans plugin source code for forbidden tokens before compilation.

```typescript
staticAuditPluginSource(source: string): string[]
```

**Returns:** Array of forbidden tokens found (empty = safe to compile)

**Blocked tokens:** `globalThis`, `fetch`, `XMLHttpRequest`, `eval`, `Function`, `require`, `import`, `process`, `__dirname`, `__filename`

### PluginRegistry

In-memory registry for managing installed plugins.

```typescript
class PluginRegistry {
  register(plugin: CompiledPlugin): void;
  unregister(pluginId: string): void;
  runAll(session: Session): Promise<Map<string, PluginResult>>;
}
```

### Types

```typescript
interface PluginManifest {
  id: string;              // Reverse-DNS (e.g., "org.hrv.poincare")
  name: string;            // Display name
  version: string;         // Semver
  permissions: string[];   // Currently: ['read:session']
}

interface PluginResult {
  metrics: Record<string, number>;
  notes?: string[];
}

type PluginPermission = 'read:session' | 'read:baseline';
```

---

## Marketplace

**Module:** `src/plugins/marketplace.ts`

### Constants

```typescript
const CATALOG_SCHEMA_VERSION = 1;
```

### installPlugin

Verifies fingerprint, compiles, and persists a plugin.

```typescript
installPlugin(
  entry: CatalogEntry,
  storage: PluginStorage
): Promise<void>
```

### installPluginFromJson

User-friendly paste-and-install from a JSON string.

```typescript
installPluginFromJson(
  rawJson: string,
  storage: PluginStorage
): Promise<void>
```

### loadInstalledPlugins

Recompiles all installed plugins from storage. Drops any that fail compilation.

```typescript
loadInstalledPlugins(
  storage: PluginStorage
): Promise<CompiledPlugin[]>
```

### validateCatalog

Validates a plugin catalog against the schema and verifies fingerprints.

```typescript
validateCatalog(catalog: PluginCatalog): ValidationResult
```

**Fingerprint:** SHA-256 hex digest of the plugin source code.

---

## Open HRV Protocol (OHP)

**Module:** `src/plugins/protocol.ts`

### Constants

```typescript
const OHP_VERSION = 1;
```

### Types

```typescript
interface OhpSession {
  // Normalized session data
  // camelCase properties, ISO timestamps, ms-valued metrics
}

interface OhpBundle {
  schemaVersion: number;
  generatedAt: string;     // ISO 8601
  baseline?: BaselineResult;
  sessions: OhpSession[];
}
```

### Functions

```typescript
toOhpSession(session: Session): OhpSession
fromOhpSession(o: OhpSession): Session
buildOhpBundle(sessions: Session[], generator: string, baseline?: BaselineResult): OhpBundle
validateOhpBundle(input: unknown): ValidationResult
```

---

## Reference Plugins

**Module:** `src/plugins/reference/index.ts`

Five built-in plugins:

| ID | Name | Metrics |
|----|------|---------|
| `org.hrv.poincare` | Poincaré SD1/SD2 | `sd1`, `sd2`, `sd1_sd2_ratio` |
| `org.hrv.fft_lf_hf` | FFT LF/HF | `lf_power`, `hf_power`, `lf_hf_ratio` |
| `org.hrv.dfa_alpha1` | DFA-α1 | `dfa_alpha1` (~0.75 = aerobic threshold) |
| `org.hrv.recovery_velocity` | Recovery Velocity | `recovery_velocity` |
| `org.hrv.weekly_zscore` | Weekly Z-Score | `weekly_zscore` |
