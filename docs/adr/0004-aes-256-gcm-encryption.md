# ADR-0004: AES-256-GCM for All Encryption

## Status

Accepted (protocol v4, supersedes v1–v3)

## Context

The app encrypts data in three contexts: backup files, cloud sync blobs, and coach share bundles. Earlier protocol versions used:
- v1: AES-256-CTR (no integrity)
- v2: AES-256-CTR + HMAC-SHA256 (encrypt-then-MAC)
- v3: AES-256-GCM (authenticated encryption) with SHA-256-based KDF

v1–v2 had no authentication or weak MAC separation. v3 improved on this but used a fast KDF vulnerable to offline brute-force on short passphrases.

## Decision

Protocol v4 uses **AES-256-GCM** (authenticated encryption with associated data) with a **memory-hard scrypt KDF** (N=2¹⁴, r=8, p=1) and per-blob random salt.

Implementation:
- `src/sync/crypto.ts` — encryption/decryption pipeline
- `src/sync/aesGcm.ts` — AES-GCM cipher wrapper (@noble/ciphers)
- `src/sync/scryptKdf.ts` — scrypt key derivation (@noble/hashes)

Backward compatibility: v1–v3 blobs still decrypt (the version byte selects the correct pipeline), but all new writes use v4.

## Consequences

- Memory-hard KDF makes offline brute-force ~10⁴–10⁵× more expensive than v3
- Per-blob salt prevents precomputation attacks
- Authenticated encryption detects tampering (no silent corruption)
- v4 blobs are ~32 bytes larger (salt field)
- Old clients that only understand v1–v3 cannot read v4 blobs (forward incompatible, as intended)
- @noble/ciphers + @noble/hashes are audited, pure-JS libraries — no native dependency
