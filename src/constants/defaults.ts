export const RECORDING_DURATION_SECONDS = 300; // 5 minutes
export const MIN_RECORDING_SECONDS = 120; // 2 minutes minimum
export const MIN_BASELINE_DAYS = 5;
export const ARTIFACT_WARNING_THRESHOLD = 0.05; // 5%
export const ARTIFACT_DEVIATION_FACTOR = 0.20; // 20% deviation from local median

export const TRAINING_TYPES = [
  'Strength',
  'BJJ',
  'Cycling',
  'Rest',
  'Other',
] as const;

export type TrainingType = typeof TRAINING_TYPES[number];
