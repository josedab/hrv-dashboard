/** Standard recording duration (5 minutes per ESC short-term HRV guidelines). */
export const RECORDING_DURATION_SECONDS = 300;
/** Minimum recording time before early finish is allowed. */
export const MIN_RECORDING_SECONDS = 120;
/** Minimum days of data required before a verdict can be issued. */
export const MIN_BASELINE_DAYS = 5;
/** Artifact rate above this value triggers a warning in the UI. */
export const ARTIFACT_WARNING_THRESHOLD = 0.05;
/** RR intervals deviating more than this fraction from local median are flagged as artifacts. */
export const ARTIFACT_DEVIATION_FACTOR = 0.20;

/** Available training types for post-recording subjective log. */
export const TRAINING_TYPES = [
  'Strength',
  'BJJ',
  'Cycling',
  'Rest',
  'Other',
] as const;

/** Union type of available training types. */
export type TrainingType = typeof TRAINING_TYPES[number];
