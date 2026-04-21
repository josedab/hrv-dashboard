---
sidebar_position: 10
title: Plugins
---

# Plugin System

Extend the HRV Dashboard with **custom metric plugins**. The plugin system lets you compute additional metrics from your RR interval data using a sandboxed JavaScript runtime.

## Built-in Reference Plugins

The app ships with 5 reference plugins you can enable immediately:

| Plugin | ID | What It Computes |
|--------|----|-----------------|
| **Poincaré SD1/SD2** | `org.hrv.poincare` | Short-term (SD1) and long-term (SD2) variability from the Poincaré plot |
| **FFT LF/HF** | `org.hrv.fft_lf_hf` | Frequency-domain power via Lomb–Scargle periodogram |
| **DFA-α1** | `org.hrv.dfa_alpha1` | Detrended Fluctuation Analysis — aerobic threshold marker (~0.75 = VT1) |
| **Recovery Velocity** | `org.hrv.recovery_velocity` | How quickly your rMSSD rebounds after a dip |
| **Weekly Z-Score** | `org.hrv.weekly_zscore` | Standard deviations from your 7-day mean |

## Using Plugins

1. Go to **Plugins** screen from the navigation menu
2. Browse the **marketplace** of available plugins
3. Tap **Install** on any plugin you want
4. The plugin runs automatically on every new recording
5. Plugin metrics appear alongside your standard metrics in the session detail view

## How Plugins Work

Plugins are **sandboxed JavaScript functions** that receive a session and return computed metrics:

```typescript
interface PluginManifest {
  id: string;           // Reverse-DNS identifier
  name: string;         // Display name
  version: string;      // Semver
  permissions: string[];// Currently: ['read:session']
}

// Plugin compute function
compute(session: Session): Promise<PluginResult>

// Result
interface PluginResult {
  metrics: Record<string, number>;  // Key-value metric pairs
  notes?: string[];                 // Optional interpretive notes
}
```

## Security Sandbox

Plugins run in a **restricted sandbox** with strict safety guarantees:

- **250ms execution timeout** — plugins that take too long are terminated
- **No network access** — `fetch`, `XMLHttpRequest`, and other network APIs are blocked
- **No globals** — `globalThis`, `window`, `process`, `require` are all blocked
- **Static source audit** — plugin source is scanned for forbidden tokens before compilation
- **Read-only data** — plugins can only read session data (`read:session` permission), never write
- **SHA-256 fingerprint** — each plugin's source is fingerprinted at install time to detect tampering

## Installing from JSON

You can install plugins by pasting a JSON manifest:

```typescript
installPluginFromJson(rawJson: string, storage: PluginStorage): Promise<void>
```

The JSON must include the manifest fields and a `source` field containing the plugin's JavaScript code. The fingerprint (SHA-256 of source) is verified on install.

## Open HRV Protocol (OHP)

The plugin system uses the **Open HRV Protocol** (OHP v1) as its interchange format:

```typescript
interface OhpSession {
  // Normalized session data in camelCase
  // ISO timestamps, millisecond-valued metrics
}

interface OhpBundle {
  schemaVersion: number;
  generatedAt: string;
  baseline?: BaselineResult;
  sessions: OhpSession[];
}
```

This format enables interoperability between HRV tools and plugins, regardless of the source application.

## Writing a Custom Plugin

Here's a minimal plugin that computes the coefficient of variation:

```javascript
// manifest.json
{
  "id": "com.example.cv",
  "name": "Coefficient of Variation",
  "version": "1.0.0",
  "permissions": ["read:session"]
}

// source.js
async function compute(session) {
  const rr = session.rrIntervals;
  if (rr.length < 2) return { metrics: { cv: 0 } };

  const mean = rr.reduce((a, b) => a + b, 0) / rr.length;
  const variance = rr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / rr.length;
  const stdDev = Math.sqrt(variance);

  return {
    metrics: { cv: (stdDev / mean) * 100 },
    notes: [`CV = ${((stdDev / mean) * 100).toFixed(1)}%`]
  };
}
```

Install via the Plugins screen → **Install from JSON**, and paste the manifest + source as a JSON object.
