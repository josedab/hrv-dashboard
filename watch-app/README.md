# Watch companions

Native watch companion apps for Apple Watch (watchOS) and Wear OS. Both
implement the same JSON bridge contract so HRV math, payload validation
and ingestion stay consistent across platforms.

- **Bridge contract**: [`src/watch/index.ts`](../src/watch/index.ts)
- **Apple Watch skeleton**: [`ios/README.md`](ios/README.md)
- **Wear OS skeleton**: [`android/README.md`](android/README.md)
- **Golden vectors**: [`__tests__/watch/watchBridge.test.ts`](../__tests__/watch/watchBridge.test.ts)

The native projects are not committed; they are generated locally via
`npx expo prebuild` and then extended with the watch/wear targets.

## Standalone Recording (G3)

Both `RecordingSession.swift` and `RecordingSession.kt` provide a
phone-independent recording manager. Append RR intervals as they arrive
from the BLE notification, call `stop()`, then `serializeForSync()`
to hand the dictionary back to the host React Native app via the
`watchConnectivity` / `MessageClient` bridge for SQLite insertion.

Verdict thresholds and HRV math are identical to `src/hrv/metrics.ts`
and `src/hrv/verdict.ts` — see the unit tests for golden vectors.
