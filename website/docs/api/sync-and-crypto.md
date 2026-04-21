---
sidebar_position: 6
---

# Sync & Crypto API

API reference for the end-to-end encrypted sync engine, backup system, and coach sharing protocol.

## Sync Engine

**Module:** `src/sync/index.ts`

### Constants

```typescript
const SYNC_PROTOCOL_VERSION = 4;
```

### encryptSessionBlob

Encrypts a session for cloud storage with per-blob salt.

```typescript
encryptSessionBlob(
  session: Session,
  passphrase: string,
  updatedAt: string
): Promise<EncryptedSessionBlob>
```

### decryptSessionBlob

Decrypts a session blob with automatic format detection (v1–v4).

```typescript
decryptSessionBlob(
  blob: EncryptedSessionBlob,
  passphrase: string
): Promise<Session>
```

### resolveConflict

Last-write-wins conflict resolution by `updatedAt` timestamp.

```typescript
resolveConflict(
  local: EncryptedSessionBlob,
  remote: EncryptedSessionBlob
): EncryptedSessionBlob
```

### runSync

Bidirectional sync with upload, download, and reconciliation.

```typescript
runSync(opts: SyncEngineOptions): Promise<SyncResult>
```

**SyncEngineOptions:**
- `passphrase: string` — user's encryption passphrase
- `provider: SyncProvider` — sync backend (Supabase, in-memory)
- `localSessions: Session[]` — current local data

---

## Crypto Layer

**Module:** `src/sync/crypto.ts`

### encryptString

Encrypts plaintext using AES-256-GCM with scrypt KDF (always v4).

```typescript
encryptString(
  plaintext: string,
  passphrase: string,
  context: string
): Promise<EncryptedString>
```

### decryptString

Decrypts ciphertext with automatic version detection.

```typescript
decryptString(
  ciphertext: string,
  passphrase: string,
  context: string,
  iv: string,
  mac?: string,
  version?: number,
  salt?: string
): Promise<string>
```

### Constants

```typescript
const IV_LENGTH = 12;        // AES-GCM nonce length (bytes)
const AES_KEY_LENGTH = 32;   // 256-bit key
const KDF_ITERATIONS = 10000; // For v3 fallback
// v4: scrypt N=2^14, r=8, p=1, dkLen=32
```

---

## Sync Provider Interface

```typescript
interface SyncProvider {
  upload(blob: EncryptedSessionBlob): Promise<void>;
  download(since: string): Promise<EncryptedSessionBlob[]>;
  delete(sessionId: string): Promise<void>;
}
```

Built-in providers:
- `cloudProviders.ts` — Supabase (production)
- `inMemoryProvider.ts` — In-memory (testing)

---

## Share Protocol

**Module:** `src/share/index.ts`

### Constants

```typescript
const SHARE_PROTOCOL_VERSION = 4;
const DEFAULT_SHARE_TTL_DAYS = 7;
```

### sealShare

Creates an encrypted share bundle with a pairing code.

```typescript
sealShare(
  allSessions: Session[],
  opts?: { ttlDays?: number }
): Promise<SealedShare>
```

**Returns:**
```typescript
interface SealedShare {
  bundle: ShareBundle;    // Encrypted data
  pairingCode: string;    // e.g., "XXXX-alpine-breeze-coral-drift"
}
```

### openShare

Decrypts a share bundle using the pairing code. Checks expiry.

```typescript
openShare(
  bundle: ShareBundle,
  pairingCode: string,
  opts?: { now?: Date }
): Promise<SharePayload>
```

---

## Backup

**Module:** `src/utils/backup.ts`

### Constants

```typescript
const BACKUP_VERSION = 4;
```

### createBackup

Encrypts all sessions and settings, saves as `.hrvbak` file.

```typescript
createBackup(passphrase: string): Promise<void>
```

### restoreBackup

Decrypts a backup file and imports sessions.

```typescript
restoreBackup(
  fileUri: string,
  passphrase: string
): Promise<number>  // Returns count of imported sessions
```

**Backup format (v4):**
```json
{
  "v": 4,
  "salt": "<hex>",
  "iv": "<hex>",
  "data": "<base64 AES-256-GCM ciphertext>"
}
```
