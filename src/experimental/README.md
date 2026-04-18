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
| `ble/deviceProfiles.ts` | Per-device HRM tuning; not used by `bleManager` yet. |
| `web/dashboard.ts` | Pure data shaper for a future browser viewer. |
| `integrations/healthTwoWay.ts` | Two-way sync prototype. |
| `integrations/sleepStrain.ts` | Strain fusion + integrated recovery (sleep-only reading was graduated to `src/integrations/healthSleep.ts`). |
| `integrations/import/{vendors,wizard}.ts` | CSV importers for Whoop/Oura/etc. |
| `team/aggregation.ts` | Coach roll-up of multi-athlete sessions. |
| `watch/{index,goldenVectors}.ts` | Watch-side recording pipeline + parity vectors. |
| `workout/{exporters,pushService}.ts` | .zwo / .fit export + Garmin/Strava push. |

`src/workout/generator.ts` is **not** experimental — it's used by `WorkoutCard`
and ships today. Same for `src/integrations/healthSleep.ts` and
`src/integrations/healthAutoPull.ts`, which power the LogScreen sleep auto-prefill.
