# Cryptography & Protocol Versions

This document describes the on-disk and on-the-wire formats used by the
HRV Readiness Dashboard for backups, share bundles, and cloud sync, and
the operator-facing migrations required when upgrading the app.

## Current state

All three envelopes (backup file, share bundle, sync blob) are at
**protocol v4** as of the scrypt KDF migration:

| Layer  | Constant                  | File                          |
|--------|---------------------------|-------------------------------|
| Sync   | `SYNC_PROTOCOL_VERSION`   | `src/sync/index.ts`           |
| Share  | `SHARE_PROTOCOL_VERSION`  | `src/share/index.ts`          |
| Backup | `BACKUP_VERSION`          | `src/utils/backup.ts`         |

v4 uses **AES-256-GCM** for authenticated encryption with a key derived
from the user passphrase via **scrypt** (`N=2¹⁴, r=8, p=1, dkLen=32`)
and a per-blob random 16-byte salt.

The scrypt KDF is memory-hard, making offline brute-force against a
leaked file or stolen relay copy ~10⁴–10⁵× more expensive per guess
than the previous iterated-SHA-256 KDF (v3).

## Backwards compatibility

A v4 client can still read every historical blob:

| Blob version | KDF                    | Cipher           | Integrity                         |
|--------------|------------------------|------------------|-----------------------------------|
| v1 (legacy)  | Iterated SHA-256       | SHA-256 CTR XOR  | SHA-256 of plaintext              |
| v2 (legacy)  | Iterated SHA-256       | SHA-256 CTR XOR  | HMAC-SHA-256(iv ‖ ciphertext)     |
| v3 (legacy)  | Iterated SHA-256       | AES-256-GCM      | GCM tag                           |
| **v4 (now)** | **scrypt (N=2¹⁴)**     | **AES-256-GCM**  | **GCM tag**                       |

New encryptions always emit v4. Older blobs continue to decrypt; they
are upgraded to v4 the next time the user re-uploads / re-shares /
re-exports, so there is no migration sweep.

## Operator action required: Supabase schema migration

If you are running the optional Supabase sync provider, the
`hrv_session_blobs` table needs a nullable `salt` column to store the
per-blob scrypt salt for v4 uploads. Without it, v4 sync writes will
fail and other clients will not be able to decrypt v4 blobs (the
required salt would be silently dropped on the wire).

Run once per Supabase project:

```sql
alter table hrv_session_blobs
  add column if not exists salt text;
```

The column must be nullable — v1/v2/v3 blobs already in the table
continue to read with `salt = NULL`.

The full target schema is:

```sql
create table if not exists hrv_session_blobs (
  user_id uuid not null references auth.users on delete cascade,
  session_id text not null,
  protocol_version int not null,
  updated_at timestamptz not null,
  iv text not null,
  ciphertext text not null,
  mac text,                    -- v2 HMAC; null for v3/v4
  salt text,                   -- v4 scrypt salt; null for v1/v2/v3
  primary key (user_id, session_id)
);
alter table hrv_session_blobs enable row level security;
create policy own_rows on hrv_session_blobs
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## Wire format (v4)

### Sync blob (`EncryptedSessionBlob`)

```json
{
  "protocolVersion": 4,
  "sessionId": "<uuid>",
  "updatedAt": "<iso8601>",
  "iv": "<24 hex chars>",
  "ciphertext": "<hex; trailing 32 hex = GCM tag>",
  "salt": "<32 hex chars>"
}
```

The `updatedAt` field is also bound *inside* the encrypted payload as
`{__updatedAt, session}` so a tampered envelope can't move conflict
resolution against you.

### Share bundle (`ShareBundle`)

```json
{
  "protocolVersion": 4,
  "bundleId": "<4 chars>",
  "expiresAt": "<iso8601>",
  "iv": "<24 hex>",
  "ciphertext": "<hex; trailing 32 hex = GCM tag>",
  "salt": "<32 hex>"
}
```

The `expiresAt` field is also bound inside the encrypted payload —
extending an envelope's lifetime by editing the outer JSON yields a
"tampered" rejection on `openShare`.

### Backup file (`.hrvbak` JSON)

```json
{
  "v": 4,
  "salt": "<32 hex>",
  "iv": "<24 hex>",
  "data": "<hex; trailing 32 hex = GCM tag>"
}
```

## Defense-in-depth checks at the dispatch layer

`decryptSessionBlob`, `openShare`, and `restoreBackup` reject malformed
envelopes *before* attempting decryption to fail closed and prevent
downgrade attacks:

- `protocolVersion` / `v` must be a numeric integer (no string coercion)
- A `protocolVersion === 4` envelope with a missing `salt` is rejected
- A `protocolVersion < 4` envelope with a `salt` field is rejected
  (catches an attacker stripping the version field while smuggling a
  forged salt)

## Pairing-code entropy (share)

Pairing codes use a CSPRNG (`expo-crypto`) over a 256-word list of
short, unambiguous English words. Format: `BBBB-w-w-w-w` (4-char
hex bundle id + 4 random words). Approximate entropy: ~32 bits in the
passphrase portion alone, plus the bundle id.

## Adding a new protocol version

If you change *any* scrypt parameter (`N`, `r`, `p`, `dkLen`) or the
salt length, bump the relevant `*_PROTOCOL_VERSION` / `BACKUP_VERSION`
constant and add a new dispatch branch in `src/sync/crypto.ts` (and
`src/utils/backup.ts` for the backup path). Keep all older branches
intact for read-back-compat. Add a v(N-1) → v(N) round-trip test in the
respective `__tests__/` file.
