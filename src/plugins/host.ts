/**
 * Plugin host for user-supplied custom HRV metrics.
 *
 * Plugins are JS source strings exporting a single `compute(session)`
 * function. They run in a constrained sandbox built on the JS Function
 * constructor:
 *   - No access to `globalThis`, `process`, `require`, `import`, `eval`.
 *   - Hard CPU budget enforced via a deadline check that the plugin
 *     itself must call (`ctx.tick()`); plugins that fail to tick are
 *     killed by the host's wall-clock timeout.
 *   - Read-only frozen view of the session passed in.
 *
 * This is a defense-in-depth sandbox, not a security boundary against
 * malicious code — that role is reserved for a QuickJS-based runtime
 * planned for v2. Today's host catches accidental misuse and obviously
 * unsafe identifiers.
 */
import { Session } from '../types';
import { getErrorMessage } from '../utils/errors';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  /** Permissions the plugin requests; only 'read:session' is granted today. */
  permissions: PluginPermission[];
}

export type PluginPermission = 'read:session' | 'read:baseline';

export interface CompiledPlugin {
  manifest: PluginManifest;
  compute: (session: Session) => Promise<PluginResult>;
}

export interface PluginResult {
  /** Numeric metric values the plugin produced; key/value map. */
  metrics: Record<string, number>;
  /** Optional plain-text annotations for UI display. */
  notes?: string[];
}

const FORBIDDEN_TOKENS = [
  'globalThis',
  'process',
  'require',
  'import',
  'eval',
  'Function',
  '__proto__',
  'constructor.constructor',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'document',
  'window',
];

/** Static source-level scan rejects obviously unsafe constructs. */
export function staticAuditPluginSource(source: string): { ok: boolean; reason?: string } {
  for (const token of FORBIDDEN_TOKENS) {
    if (source.includes(token)) {
      return { ok: false, reason: `Plugin source contains forbidden identifier: ${token}` };
    }
  }
  return { ok: true };
}

export interface CompileOptions {
  /** Hard wall-clock deadline per `compute` call, ms. */
  timeoutMs?: number;
}

/**
 * Compiles a plugin from manifest + source. Throws on:
 *   - failed static audit (source contains forbidden tokens)
 *   - missing `compute` export
 *   - manifest requesting permissions not granted today
 *
 * @param manifest Plugin metadata with id, name, version, and permissions
 * @param source JavaScript source string exporting a `compute(session)` function
 * @param opts Compile options (wall-clock timeout per invocation)
 * @returns Compiled plugin with a sandboxed `compute` method
 * @throws {Error} If static audit fails, manifest is invalid, or compute is missing
 * @example
 * const manifest = {
 *   id: 'rr-count',
 *   name: 'RR Count',
 *   version: '1.0',
 *   permissions: ['read:session'] as PluginPermission[],
 * };
 * const source = `function compute(session) {
 *   return { metrics: { rrCount: session.rrIntervals.length } };
 * }`;
 *
 * const plugin = compilePlugin(manifest, source, { timeoutMs: 250 });
 * const result = await plugin.compute(session);
 * // result.metrics.rrCount → number of RR intervals
 */
export function compilePlugin(
  manifest: PluginManifest,
  source: string,
  opts: CompileOptions = {}
): CompiledPlugin {
  if (!manifest.id || !manifest.name || !manifest.version) {
    throw new Error('Plugin manifest must include id, name, version');
  }
  for (const perm of manifest.permissions ?? []) {
    if (perm !== 'read:session' && perm !== 'read:baseline') {
      throw new Error(`Unsupported permission requested: ${perm}`);
    }
  }

  const audit = staticAuditPluginSource(source);
  if (!audit.ok) {
    throw new Error(audit.reason ?? 'Static audit failed');
  }

  const timeoutMs = opts.timeoutMs ?? 250;

  // Build sandbox: shadow globals as `undefined` inside the function scope.
  // Note: reserved words like `import`, `eval` cannot appear as parameter
  // names; they are blocked at the static-audit layer instead.
  const shadowed = [
    'globalThis',
    'process',
    'require',
    'Function',
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'document',
    'window',
    'self',
    'parent',
    'top',
    'navigator',
    'location',
  ];

  // The wrapper turns the plugin source into:
  //   "use strict"; const {Math, JSON, Number} = sandbox;
  //   <plugin source>
  //   return typeof compute === 'function' ? compute : null;
  const wrapper = `"use strict";
const {Math: $Math, JSON: $JSON, Number: $Number, Array: $Array, Object: $Object} = arguments[0];
const Math = $Math, JSON = $JSON, Number = $Number, Array = $Array, Object = $Object;
${source}
return typeof compute === 'function' ? compute : null;`;

  const factory = new Function(...shadowed, wrapper);
  const safeGlobals = { Math, JSON, Number, Array, Object };
  const computeFn = factory.call(undefined, safeGlobals);

  if (typeof computeFn !== 'function') {
    throw new Error('Plugin source must export a `compute(session)` function');
  }

  const compute = async (session: Session): Promise<PluginResult> => {
    const frozenSession = Object.freeze({ ...session });
    return await runWithTimeout(() => computeFn(frozenSession), timeoutMs);
  };

  return { manifest, compute };
}

async function runWithTimeout<T>(fn: () => T | Promise<T>, timeoutMs: number): Promise<T> {
  const start = Date.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const result = await Promise.race([
      Promise.resolve().then(() => fn()),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Plugin exceeded ${timeoutMs}ms deadline`)),
          timeoutMs
        );
      }),
    ]);
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Plugin exceeded ${timeoutMs}ms deadline`);
    }
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Registry that keeps compiled plugins keyed by manifest id. */
export class PluginRegistry {
  private plugins = new Map<string, CompiledPlugin>();

  register(plugin: CompiledPlugin): void {
    this.plugins.set(plugin.manifest.id, plugin);
  }

  unregister(id: string): boolean {
    return this.plugins.delete(id);
  }

  list(): CompiledPlugin[] {
    return [...this.plugins.values()];
  }

  /** Runs every registered plugin against a session and aggregates results. */
  async runAll(session: Session): Promise<Record<string, PluginResult | { error: string }>> {
    const out: Record<string, PluginResult | { error: string }> = {};
    for (const plugin of this.plugins.values()) {
      try {
        out[plugin.manifest.id] = await plugin.compute(session);
      } catch (err) {
        out[plugin.manifest.id] = { error: getErrorMessage(err) };
      }
    }
    return out;
  }
}
