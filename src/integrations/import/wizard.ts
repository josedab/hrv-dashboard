/**
 * Vendor-import wizard pipeline.
 *
 * Three-step flow that the UI drives:
 *   1. parse  → run the source-specific parser, return a preview
 *   2. plan   → diff against existing session IDs/timestamps (collisions)
 *   3. commit → INSERT only non-colliding sessions, returning a summary
 *
 * Pure functions; the UI screen wires them to file-picker, table view,
 * and the session repository. Re-import is idempotent because session
 * IDs are derived deterministically by `vendors.uuidLike(source:extId)`.
 */
import { Session } from '../../types';
import { ImportResult, ImportSource, parseImport } from './vendors';

export interface ImportPreview {
  source: ImportSource;
  total: number;
  willInsert: number;
  collisions: number;
  collisionIds: string[];
  parseErrors: { line: number; reason: string }[];
  sessions: Session[];
}

export interface ImportCommitResult {
  source: ImportSource;
  inserted: number;
  skipped: number;
  failed: { id: string; reason: string }[];
}

export type SaveSessionFn = (s: Session) => Promise<void>;
export type GetExistingIdsFn = () => Promise<Set<string>>;

/** Step 1+2: parse and diff. Pure. */
export async function planImport(
  source: ImportSource,
  content: string,
  getExistingIds: GetExistingIdsFn
): Promise<ImportPreview> {
  const parsed: ImportResult = parseImport(source, content);
  const existing = await getExistingIds();
  const collisions: string[] = [];
  const fresh: Session[] = [];
  for (const s of parsed.sessions) {
    if (existing.has(s.id)) collisions.push(s.id);
    else fresh.push(s);
  }
  return {
    source,
    total: parsed.sessions.length,
    willInsert: fresh.length,
    collisions: collisions.length,
    collisionIds: collisions,
    parseErrors: parsed.errors,
    sessions: fresh,
  };
}

/** Step 3: commit; saves each session, swallowing per-row errors. */
export async function commitImport(
  preview: ImportPreview,
  saveSession: SaveSessionFn
): Promise<ImportCommitResult> {
  let inserted = 0;
  const failed: { id: string; reason: string }[] = [];
  for (const session of preview.sessions) {
    try {
      await saveSession(session);
      inserted += 1;
    } catch (e) {
      failed.push({ id: session.id, reason: (e as Error).message ?? 'unknown' });
    }
  }
  return {
    source: preview.source,
    inserted,
    skipped: preview.collisions,
    failed,
  };
}
