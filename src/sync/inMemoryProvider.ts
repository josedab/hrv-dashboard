/**
 * In-memory sync provider — useful for tests and as a reference
 * implementation showing the contract that real iCloud / Google Drive
 * adapters must satisfy.
 */
import { EncryptedSessionBlob, SyncProvider } from './index';

export class InMemorySyncProvider implements SyncProvider {
  readonly id = 'in-memory';
  private store = new Map<string, EncryptedSessionBlob>();

  async list(): Promise<string[]> {
    return [...this.store.keys()];
  }

  async get(sessionId: string): Promise<EncryptedSessionBlob | null> {
    return this.store.get(sessionId) ?? null;
  }

  async put(blob: EncryptedSessionBlob): Promise<void> {
    this.store.set(blob.sessionId, blob);
  }

  async remove(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }

  /** Test helper. */
  size(): number {
    return this.store.size;
  }
}
