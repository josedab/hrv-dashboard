/**
 * Guided morning protocol hook.
 *
 * Orchestrates the three-phase morning HRV flow:
 *   1. Guided breathing (2 min) — calms sympathetic drive
 *   2. HRV recording (5 min) — standard ESC short-term protocol
 *   3. Log (optional) — subjective data entry
 *
 * The hook manages phase transitions, timing, and provides a clean
 * interface for the UI to render step indicators and auto-advance.
 */

export type ProtocolPhase = 'breathing' | 'recording' | 'log' | 'complete';

export interface ProtocolConfig {
  /** Breathing phase duration in seconds. 0 to skip. */
  breathingDurationSeconds: number;
  /** Recording phase duration in seconds. */
  recordingDurationSeconds: number;
  /** Whether to show the log phase. */
  showLog: boolean;
}

export const DEFAULT_PROTOCOL_CONFIG: ProtocolConfig = {
  breathingDurationSeconds: 120, // 2 minutes
  recordingDurationSeconds: 300, // 5 minutes
  showLog: true,
};

export const QUICK_PROTOCOL_CONFIG: ProtocolConfig = {
  breathingDurationSeconds: 0, // skip breathing
  recordingDurationSeconds: 180, // 3 minutes
  showLog: true,
};

export interface ProtocolState {
  phase: ProtocolPhase;
  /** 1-based step number for UI display. */
  stepNumber: number;
  /** Total number of steps (depends on config). */
  totalSteps: number;
  /** Seconds elapsed in the current phase. */
  phaseElapsed: number;
  /** Seconds remaining in the current phase (0 for log/complete). */
  phaseRemaining: number;
  /** Whether the current phase can be skipped/advanced. */
  canAdvance: boolean;
  /** Progress through the current phase (0–1). */
  phaseProgress: number;
}

/**
 * Computes the ordered list of phases for a given config.
 */
export function getPhaseSequence(config: ProtocolConfig): ProtocolPhase[] {
  const phases: ProtocolPhase[] = [];
  if (config.breathingDurationSeconds > 0) phases.push('breathing');
  phases.push('recording');
  if (config.showLog) phases.push('log');
  phases.push('complete');
  return phases;
}

/**
 * Pure function: given the current phase, elapsed time, and config,
 * returns whether the phase should auto-advance.
 */
export function shouldAutoAdvance(
  phase: ProtocolPhase,
  phaseElapsed: number,
  config: ProtocolConfig
): boolean {
  switch (phase) {
    case 'breathing':
      return phaseElapsed >= config.breathingDurationSeconds;
    case 'recording':
      return phaseElapsed >= config.recordingDurationSeconds;
    case 'log':
    case 'complete':
      return false; // user-driven advance
  }
}

/**
 * Pure function: compute the protocol state from phase index and elapsed time.
 */
export function computeProtocolState(
  phases: ProtocolPhase[],
  currentPhaseIndex: number,
  phaseElapsed: number,
  config: ProtocolConfig
): ProtocolState {
  const phase = phases[currentPhaseIndex] ?? 'complete';
  const totalSteps = phases.filter((p) => p !== 'complete').length;
  const stepNumber = Math.min(currentPhaseIndex + 1, totalSteps);

  let phaseDuration = 0;
  switch (phase) {
    case 'breathing':
      phaseDuration = config.breathingDurationSeconds;
      break;
    case 'recording':
      phaseDuration = config.recordingDurationSeconds;
      break;
  }

  const phaseRemaining = phaseDuration > 0 ? Math.max(0, phaseDuration - phaseElapsed) : 0;
  const phaseProgress = phaseDuration > 0 ? Math.min(1, phaseElapsed / phaseDuration) : 0;

  // Breathing can always be skipped; recording can be finished early after 2 min
  const canAdvance =
    phase === 'breathing' || (phase === 'recording' && phaseElapsed >= 120) || phase === 'log';

  return {
    phase,
    stepNumber,
    totalSteps,
    phaseElapsed,
    phaseRemaining,
    canAdvance,
    phaseProgress,
  };
}
