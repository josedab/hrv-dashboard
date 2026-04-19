# ADR-0002: Population Standard Deviation for SDNN

## Status

Accepted

## Context

SDNN (Standard Deviation of NN intervals) can be computed using either sample standard deviation (÷ N−1) or population standard deviation (÷ N). Most statistics libraries default to sample std dev (Bessel's correction), but the choice depends on whether the data is a sample from a larger population or the complete population.

## Decision

Use **population standard deviation (÷ N)** for SDNN computation. The RR intervals recorded during a 5-minute session represent the complete set of heartbeats in that window, not a sample from a larger population.

Implementation: `computeSdnn()` in `src/hrv/metrics.ts` divides by `rrIntervals.length` (N), not `rrIntervals.length - 1` (N−1).

## Consequences

- SDNN values are slightly lower than sample-std-dev implementations (by a factor of √(N/(N−1)), which is negligible for N > 200 beats)
- Consistent with the Task Force of ESC/NASPE (1996) recommendation for short-term recordings
- Users comparing our SDNN values to apps using sample std dev will see a small discrepancy
- The `pNN50` metric uses the same denominator convention for consistency
