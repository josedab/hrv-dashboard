import {
  toOhpSession,
  fromOhpSession,
  buildOhpBundle,
  validateOhpBundle,
  OHP_VERSION,
} from '../../src/plugins/protocol';
import {
  staticAuditPluginSource,
  compilePlugin,
  PluginRegistry,
  PluginManifest,
} from '../../src/plugins/host';
import { Session } from '../../src/types';

function makeSession(id = 's1'): Session {
  return {
    id,
    timestamp: '2026-04-15T06:30:00Z',
    durationSeconds: 300,
    rrIntervals: [800, 820, 810, 805],
    rmssd: 42,
    sdnn: 20,
    meanHr: 60,
    pnn50: 15,
    artifactRate: 0,
    verdict: 'moderate',
    perceivedReadiness: 4,
    trainingType: 'Cycling',
    notes: 'fine',
    sleepHours: 7.5,
    sleepQuality: 4,
    stressLevel: 2,
    source: 'chest_strap',
  };
}

describe('OHP wire format', () => {
  it('round-trips a session', () => {
    const original = makeSession();
    const wire = toOhpSession(original);
    const restored = fromOhpSession(wire);
    expect(restored).toEqual(original);
  });

  it('falls back to chest_strap for non-mobile sources', () => {
    const wire = toOhpSession(makeSession());
    wire.source = 'watchos';
    const restored = fromOhpSession(wire);
    expect(restored.source).toBe('chest_strap');
  });

  it('rejects newer schema versions', () => {
    const wire = toOhpSession(makeSession());
    wire.schemaVersion = OHP_VERSION + 1;
    expect(() => fromOhpSession(wire)).toThrow(/newer/);
  });

  it('builds bundles with metadata', () => {
    const bundle = buildOhpBundle([makeSession()], { name: 'Tester', version: '1.0' });
    expect(bundle.schemaVersion).toBe(OHP_VERSION);
    expect(bundle.sessions).toHaveLength(1);
    expect(bundle.generator.name).toBe('Tester');
  });
});

describe('validateOhpBundle', () => {
  it('validates a well-formed bundle', () => {
    const bundle = buildOhpBundle([makeSession()], { name: 'X', version: '1' });
    expect(validateOhpBundle(bundle).ok).toBe(true);
  });

  it('rejects non-objects', () => {
    expect(validateOhpBundle(null).ok).toBe(false);
    expect(validateOhpBundle('string').ok).toBe(false);
  });

  it('reports missing fields', () => {
    const result = validateOhpBundle({ schemaVersion: 1, sessions: [{ id: 'a' } as never] });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects newer schema versions', () => {
    const result = validateOhpBundle({ schemaVersion: 99, sessions: [] });
    expect(result.ok).toBe(false);
  });
});

describe('staticAuditPluginSource', () => {
  it('rejects sources containing forbidden tokens', () => {
    expect(staticAuditPluginSource('eval("1+1")').ok).toBe(false);
    expect(staticAuditPluginSource('require("fs")').ok).toBe(false);
    expect(staticAuditPluginSource('fetch("/api")').ok).toBe(false);
  });

  it('accepts safe sources', () => {
    expect(staticAuditPluginSource('function compute(s){return {metrics:{x:s.rmssd}}}').ok).toBe(
      true
    );
  });
});

describe('compilePlugin + sandbox', () => {
  const manifest: PluginManifest = {
    id: 'sd1-sd2',
    name: 'SD1/SD2',
    version: '1.0',
    permissions: ['read:session'],
  };

  it('compiles and runs a simple plugin', async () => {
    const source = `
      function compute(session) {
        return { metrics: { rrCount: session.rrIntervals.length } };
      }
    `;
    const plugin = compilePlugin(manifest, source);
    const result = await plugin.compute(makeSession());
    expect(result.metrics.rrCount).toBe(4);
  });

  it('rejects sources with forbidden tokens', () => {
    expect(() => compilePlugin(manifest, 'eval("x")')).toThrow();
  });

  it('rejects sources without compute export', () => {
    expect(() => compilePlugin(manifest, 'const x = 1;')).toThrow(/compute/);
  });

  it('rejects manifests requesting unknown permissions', () => {
    expect(() =>
      compilePlugin(
        { ...manifest, permissions: ['read:network' as never] },
        'function compute(){return {metrics:{}}}'
      )
    ).toThrow(/permission/);
  });

  it('enforces a wall-clock timeout', async () => {
    const slow = `
      function compute() {
        const start = Date.now();
        while (Date.now() - start < 500) { /* spin */ }
        return { metrics: {} };
      }
    `;
    const plugin = compilePlugin(manifest, slow, { timeoutMs: 50 });
    await expect(plugin.compute(makeSession())).rejects.toThrow(/deadline/);
  });

  it('passes a frozen session to the plugin', async () => {
    const source = `
      function compute(session) {
        try { session.rmssd = 9999; } catch(e) { return { metrics: { frozen: 1 } }; }
        return { metrics: { frozen: 0 } };
      }
    `;
    const plugin = compilePlugin(manifest, source);
    const result = await plugin.compute(makeSession());
    expect(result.metrics.frozen).toBe(1);
  });
});

describe('PluginRegistry', () => {
  it('runs all registered plugins and aggregates results', async () => {
    const registry = new PluginRegistry();
    registry.register(
      compilePlugin(
        { id: 'a', name: 'A', version: '1', permissions: ['read:session'] },
        'function compute(){return {metrics:{a:1}}}'
      )
    );
    registry.register(
      compilePlugin(
        { id: 'b', name: 'B', version: '1', permissions: ['read:session'] },
        'function compute(){throw new Error("boom")}'
      )
    );
    const results = await registry.runAll(makeSession());
    expect((results.a as { metrics: { a: number } }).metrics.a).toBe(1);
    expect((results.b as { error: string }).error).toContain('boom');
  });

  it('unregisters by id', () => {
    const registry = new PluginRegistry();
    registry.register(
      compilePlugin(
        { id: 'a', name: 'A', version: '1', permissions: ['read:session'] },
        'function compute(){return {metrics:{}}}'
      )
    );
    expect(registry.list()).toHaveLength(1);
    expect(registry.unregister('a')).toBe(true);
    expect(registry.list()).toHaveLength(0);
  });
});
