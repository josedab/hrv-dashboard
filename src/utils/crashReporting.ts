/**
 * Crash reporting utility backed by Sentry.
 *
 * Configure via SENTRY_DSN environment variable or Expo config.
 * When no DSN is set, falls back to console logging.
 */
import * as Sentry from '@sentry/react-native';

let initialized = false;

export function initCrashReporting(): void {
  if (initialized) return;
  initialized = true;

  const dsn = process.env.SENTRY_DSN ?? process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (dsn) {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.2,
      enableAutoSessionTracking: true,
    });
  } else {
    console.log('[CrashReporting] No SENTRY_DSN configured — using console fallback');
  }
}

export function reportError(
  error: Error | string,
  context?: Record<string, unknown>
): void {
  const errorObj = typeof error === 'string' ? new Error(error) : error;

  if (Sentry.isInitialized()) {
    Sentry.captureException(errorObj, { extra: context });
  } else {
    console.error('[CrashReporting]', errorObj.message, context ?? '');
  }
}

export function setUserContext(userId: string): void {
  if (Sentry.isInitialized()) {
    Sentry.setUser({ id: userId });
  }
}

export function addBreadcrumb(message: string, data?: Record<string, unknown>): void {
  if (Sentry.isInitialized()) {
    Sentry.addBreadcrumb({ message, data });
  }
}
