# ADR-0005: Plugin Sandbox Architecture

## Status

Accepted (v1: Function constructor; v2 planned: QuickJS)

## Context

Users and researchers want custom HRV metrics beyond the built-in rMSSD/SDNN/pNN50. A plugin system enables this, but executing arbitrary user-supplied code on a mobile device poses security risks (data exfiltration, infinite loops, privilege escalation).

## Decision

Plugins are **plain JavaScript source strings** that export a `compute(session)` function. They run in a constrained sandbox:

1. **Isolation**: JS `Function` constructor with blocked globals. No access to `globalThis`, `process`, `require`, `import`, `eval`, `XMLHttpRequest`, or `fetch`.

2. **CPU budget**: Plugins must call `ctx.tick()` periodically. A wall-clock timeout (default 5 seconds) kills plugins that fail to tick.

3. **Data access**: Read-only frozen copy of the session. Plugins cannot modify the original data or access other sessions.

4. **Permissions**: Declared in the manifest (`read:session`, `read:baseline`). Only granted permissions are injected.

5. **Integrity**: Catalog entries include a SHA-256 fingerprint of the source. Install-time verification detects tampering.

Implementation: `src/plugins/host.ts` (compile + execute), `src/plugins/marketplace.ts` (catalog + install), `src/plugins/sqliteStorage.ts` (persistence).

5 reference plugins ship built-in: Poincaré SD1/SD2, FFT LF/HF, DFA-α1, Recovery Velocity, Weekly Z-Score.

## Consequences

- Users can extend the app without forking or rebuilding
- The Function constructor sandbox is defense-in-depth, not a security boundary — a QuickJS-based runtime (planned for v2) will provide stronger isolation
- Plugin source is visible and auditable (no binary blobs)
- Catalog entries are version-pinned and fingerprinted
- The marketplace architecture supports community-contributed plugins (future)
