/**
 * Crash reporting utility.
 * 
 * Currently logs to console. Replace with Sentry or similar
 * when setting up production monitoring:
 * 
 * npm install @sentry/react-native
 * Sentry.init({ dsn: 'YOUR_DSN' });
 */

let initialized = false;

export function initCrashReporting(): void {
  if (initialized) return;
  initialized = true;

  // Set up global error handlers
  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error, { isFatal });
    defaultHandler(error, isFatal);
  });

  // Unhandled promise rejections
  const originalRejectionTracking = (globalThis as any).__promiseRejectionTrackingOptions;
  if (!originalRejectionTracking) {
    // React Native tracks these by default, but we add our hook
    const { polyfillGlobal } = require('react-native/Libraries/Utilities/PolyfillFunctions');
    // Promise rejections are already tracked by RN's LogBox
  }

  console.log('[CrashReporting] Initialized (console mode)');
}

export function reportError(
  error: Error | string,
  context?: Record<string, unknown>
): void {
  const errorObj = typeof error === 'string' ? new Error(error) : error;

  // TODO: Replace with Sentry.captureException(errorObj, { extra: context })
  console.error('[CrashReporting]', errorObj.message, context ?? '');
}

export function setUserContext(userId: string): void {
  // TODO: Replace with Sentry.setUser({ id: userId })
  console.log('[CrashReporting] User context set:', userId);
}

export function addBreadcrumb(message: string, data?: Record<string, unknown>): void {
  // TODO: Replace with Sentry.addBreadcrumb({ message, data })
  console.log('[CrashReporting] Breadcrumb:', message, data ?? '');
}
