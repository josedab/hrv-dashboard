# Examples

Standalone examples demonstrating how to use the HRV engine modules
outside of the React Native app context. These are plain TypeScript
files that can be run with `npx ts-node` or copied into your own project.

## Available Examples

| Example | Description |
|---------|-------------|
| [hrv-computation.ts](hrv-computation.ts) | Compute HRV metrics from raw RR intervals |
| [spectral-analysis.ts](spectral-analysis.ts) | Frequency-domain analysis (LF/HF/VLF bands) |
| [report-generation.ts](report-generation.ts) | Generate an HTML readiness report |

## Running

```bash
npx ts-node examples/hrv-computation.ts
```

These examples import from `../src/` and use the same algorithms as the
mobile app. The HRV engine is pure TypeScript with no React Native or
native module dependencies.
