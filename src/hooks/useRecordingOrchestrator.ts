/**
 * Recording orchestration hook.
 *
 * Composes the lower-level BLE recording, HRV computation, and session
 * persistence hooks into a single state machine for the ReadingScreen.
 * Separates business logic from presentation so it can be tested and
 * reused independently.
 *
 * Phases: idle → scanning → connecting → recording → processing → complete
 */
import { HrvMetrics } from '../types';
import { filterArtifacts } from '../hrv/artifacts';
import { computeHrvMetrics } from '../hrv/metrics';

export type RecordingPhase =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'recording'
  | 'processing'
  | 'complete'
  | 'error';

export interface RecordingOrchestrationState {
  phase: RecordingPhase;
  /** Collected RR intervals during recording. */
  rrIntervals: number[];
  /** Computed metrics after processing. Null until phase = 'complete'. */
  metrics: HrvMetrics | null;
  /** Artifact rate from filtering. */
  artifactRate: number;
  /** Clean intervals after artifact removal. */
  cleanIntervals: number[];
  /** Error message if phase = 'error'. */
  error: string | null;
}

const INITIAL_STATE: RecordingOrchestrationState = {
  phase: 'idle',
  rrIntervals: [],
  metrics: null,
  artifactRate: 0,
  cleanIntervals: [],
  error: null,
};

/**
 * Pure function: process raw RR intervals into HRV metrics.
 * Called when recording stops — no side effects.
 */
export function processRecording(
  rrIntervals: number[],
  toleranceFactor: number = 1.0
): {
  metrics: HrvMetrics;
  artifactRate: number;
  cleanIntervals: number[];
  hasEnoughData: boolean;
} {
  if (rrIntervals.length < 10) {
    return {
      metrics: { rmssd: 0, sdnn: 0, meanHr: 0, pnn50: 0, artifactRate: 0 },
      artifactRate: 0,
      cleanIntervals: [],
      hasEnoughData: false,
    };
  }

  const { cleanIntervals, artifactRate } = filterArtifacts(rrIntervals, toleranceFactor);
  const metrics = computeHrvMetrics(rrIntervals);

  return {
    metrics,
    artifactRate,
    cleanIntervals,
    hasEnoughData: cleanIntervals.length >= 10,
  };
}

/**
 * Pure state reducer for the recording orchestration.
 * Screens dispatch actions; this function computes the next state.
 */
export type RecordingAction =
  | { type: 'START_SCAN' }
  | { type: 'DEVICE_FOUND' }
  | { type: 'CONNECT' }
  | { type: 'CONNECTED' }
  | { type: 'RR_DATA'; intervals: number[] }
  | { type: 'STOP_RECORDING' }
  | { type: 'PROCESS'; toleranceFactor?: number }
  | { type: 'COMPLETE'; metrics: HrvMetrics; artifactRate: number; cleanIntervals: number[] }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' };

export function recordingReducer(
  state: RecordingOrchestrationState,
  action: RecordingAction
): RecordingOrchestrationState {
  switch (action.type) {
    case 'START_SCAN':
      return { ...INITIAL_STATE, phase: 'scanning' };
    case 'DEVICE_FOUND':
      return state;
    case 'CONNECT':
      return { ...state, phase: 'connecting' };
    case 'CONNECTED':
      return { ...state, phase: 'recording' };
    case 'RR_DATA':
      return {
        ...state,
        rrIntervals: [...state.rrIntervals, ...action.intervals],
      };
    case 'STOP_RECORDING':
      return { ...state, phase: 'processing' };
    case 'PROCESS': {
      const result = processRecording(state.rrIntervals, action.toleranceFactor);
      return {
        ...state,
        phase: 'complete',
        metrics: result.metrics,
        artifactRate: result.artifactRate,
        cleanIntervals: result.cleanIntervals,
      };
    }
    case 'COMPLETE':
      return {
        ...state,
        phase: 'complete',
        metrics: action.metrics,
        artifactRate: action.artifactRate,
        cleanIntervals: action.cleanIntervals,
      };
    case 'ERROR':
      return { ...state, phase: 'error', error: action.message };
    case 'RESET':
      return INITIAL_STATE;
  }
}

/**
 * Returns the initial state for the recording orchestrator.
 */
export function getInitialRecordingState(): RecordingOrchestrationState {
  return { ...INITIAL_STATE };
}
