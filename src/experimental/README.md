# `src/experimental/`

Modules in this directory are **not yet shipped**. They have:

- No production importer (verified at audit time).
- No corresponding UI screen wired into `AppNavigator`.
- Tests covering the algorithms in isolation.

They're kept here, rather than deleted, because the algorithms (workout
exporters, watch-side HRV pipeline, vendor CSV parsers, etc.) are useful
prior art for the eventual feature implementation.

## Rules

1. **Do not import from `src/experimental/` in production code.** A module
   graduates by being moved back to its sibling production directory in
   the same change that adds the importer.
2. Each file's header carries `@experimental NOT YET SHIPPED`. Keep that
   marker in sync with reality — if you wire the module up, also remove
   the marker and move the file out of `src/experimental/`.
3. Tests for experimental modules live under `__tests__/` mirroring the
   non-experimental path (e.g. `__tests__/watch/`), pointing at
   `src/experimental/...`.

## Current contents

| Path | Status |
|------|--------|
| `web/dashboard.ts` | Pure data shaper for a future browser viewer. |
| `team/aggregation.ts` | Coach roll-up of multi-athlete sessions. |
| `watch/{index,goldenVectors}.ts` | Watch-side recording pipeline + parity vectors. |
| `workout/pushService.ts` | Garmin/Strava OAuth push service. |

### Graduated to production

The following modules have been moved to their sibling production directories:
- `ble/deviceProfiles.ts` → `src/ble/deviceProfiles.ts`
- `integrations/healthTwoWay.ts` → `src/integrations/healthTwoWay.ts`
- `integrations/sleepStrain.ts` → `src/integrations/sleepStrain.ts`
- `integrations/import/{vendors,wizard}.ts` → `src/integrations/import/`
- `workout/exporters.ts` → `src/workout/exporters.ts`
