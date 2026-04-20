/** Shared error handling utilities — extract common patterns from catch blocks. */

/**
 * Extracts a human-readable message from an unknown caught value.
 *
 * Handles the three common shapes: Error objects, plain strings,
 * and everything else (falls back to a default message).
 */
export function getErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}

/**
 * Runs a promise without awaiting it, routing failures to console.error.
 *
 * Use for best-effort side effects (widget refresh, notification cleanup)
 * where the caller doesn't need the result but failures should be tracked.
 * Crash reporting integration happens via the caller if needed.
 */
export function fireAndForget(promise: Promise<unknown>, context: string): void {
  promise.catch((e) => {
    console.error(`[fireAndForget:${context}]`, e instanceof Error ? e.message : String(e));
  });
}
