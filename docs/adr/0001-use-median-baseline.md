# ADR-0001: Use Median Baseline (Not Mean)

## Status

Accepted

## Context

The readiness verdict compares today's rMSSD to a rolling baseline. The baseline could use the mean or median of recent daily rMSSD values. Mean is simpler but sensitive to outliers — a single unusually high or low reading shifts the baseline significantly, producing misleading verdicts for days afterward.

In practice, HRV data contains natural outliers: nights of poor sleep, illness, measurement artifacts that escaped the filter, or unusually deep relaxation. These are informative signals but should not dominate the baseline.

## Decision

Use the **median** of the rolling window (default 7 days) as the baseline value. The median is computed by `computeMedian()` in `src/hrv/baseline.ts`.

Benefits:
- Robust to single-day outliers (a 50% spike doesn't move the median at all)
- Stable day-to-day behavior (users see consistent baselines)
- Aligns with published recommendations for short-term HRV monitoring (Task Force of ESC/NASPE, 1996)

## Consequences

- The baseline changes more slowly than a mean-based approach — this is intentional
- Users may need 5+ days of data before the median is meaningful (vs. 3 for a mean)
- The `MIN_BASELINE_DAYS = 5` threshold accounts for this
- Future adaptive thresholds (`adaptiveThresholds.ts`) use percentile-based cutoffs which are also median-family statistics, maintaining consistency
