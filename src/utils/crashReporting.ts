/**
 * Crash reporting utility backed by Sentry.
 *
 * Configure via SENTRY_DSN environment variable or Expo config.
 * When no DSN is set, falls back to console logging.
 */
import * as Sentry from '@sentry/react-native';

let initialized = false;

/**
 * Initializes Sentry crash reporting if a DSN is configured.
 *
 * Reads from `SENTRY_DSN` or `EXPO_PUBLIC_SENTRY_DSN` environment variables.
 * When no DSN is set, falls back to `console.error` — the app still works,
 * but errors are only logged locally. Safe to call multiple times (idempotent).
 */
export function initCrashReporting(): void {
  if (initialized) return;
  initialized = true;

  const dsn = process.env.SENTRY_DSN ?? process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (dsn) {
    try {
      Sentry.init({
        dsn,
        tracesSampleRate: 0.2,
        enableAutoSessionTracking: true,
      });
    } catch {
      console.error('[CrashReporting] Sentry.init() failed — using console fallback');
    }
  } else {
    console.log('[CrashReporting] No SENTRY_DSN configured — using console fallback');
  }
}

/**
 * Reports an error to Sentry (or console if Sentry is not initialized).
 *
 * @param error - An Error object or string message. Strings are wrapped in `new Error()`.
 * @param context - Optional key-value pairs attached as `extra` data in Sentry.
 */
export function reportError(error: Error | string, context?: Record<string, unknown>): void {
  const errorObj = typeof error === 'string' ? new Error(error) : error;

  if (initialized) {
    Sentry.captureException(errorObj, { extra: context });
  } else {
    console.error('[CrashReporting]', errorObj.message, context ?? '');
  }
}

/**
 * Associates future error reports with a user ID.
 * No-op if Sentry is not initialized.
 */
export function setUserContext(userId: string): void {
  if (initialized) {
    Sentry.setUser({ id: userId });
  }
}

/**
 * Records a breadcrumb for debugging context.
 * Breadcrumbs are attached to the next captured error in Sentry.
 * No-op if Sentry is not initialized.
 */
export function addBreadcrumb(message: string, data?: Record<string, unknown>): void {
  if (initialized) {
    Sentry.addBreadcrumb({ message, data });
  }
}
