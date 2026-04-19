# ADR-0003: Local-Only Storage with Optional Encrypted Sync

## Status

Accepted

## Context

Health data is sensitive. Most HRV apps require cloud accounts, storing heart rate and sleep data on vendor servers. Users have no visibility into how their data is used, and vendor lock-in prevents data portability.

The HRV app market is dominated by subscription models that fund cloud infrastructure. A local-first approach eliminates the need for a backend, reducing both cost and privacy risk.

## Decision

1. **All data stored locally in SQLite** (expo-sqlite with WAL mode). No cloud account required. No data leaves the device by default.

2. **Optional encrypted sync** via Supabase or compatible providers, using AES-256-GCM (protocol v4) with a user-chosen passphrase. The sync provider only sees ciphertext.

3. **Encrypted backup** (.hrvbak files) using the same AES-256-GCM protocol. Users can export and import backups without trusting any cloud service.

4. **Coach share bundles** use time-boxed, passphrase-encrypted bundles (4-word pairing code, ~32 bits entropy). Bundles expire after 7 days by default.

## Consequences

- No recurring infrastructure cost (no servers to maintain)
- Users own their data completely — can export, backup, delete at any time
- No network dependency — the app works offline
- Multi-device sync requires manual setup (passphrase + Supabase URL)
- Data loss if the user loses their device without a backup
- No population-level analytics possible (intentional — privacy over features)
