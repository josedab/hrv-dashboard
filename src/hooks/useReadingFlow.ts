import { useReducer, useCallback } from 'react';

/**
 * Reading-flow phase state machine.
 *
 * Modeled as a discriminated union so the compiler enforces that
 * `deviceId` is only present in phases where it's meaningful — preventing
 * impossible states like "recording with no device selected".
 *
 * Transitions (the only legal moves):
 *   scanning  --SELECT(skipBreathing=false)-->  breathing
 *   scanning  --SELECT(skipBreathing=true)-->   recording
 *   breathing --BREATHING_DONE-->               recording
 *   recording --RECORDING_DONE-->               complete
 *   *         --RESET-->                        scanning
 *
 * Any out-of-order action (e.g. BREATHING_DONE while in `scanning`) is
 * a no-op rather than throwing — defensive against stale callbacks /
 * fast taps where a previous async operation completes after the user
 * has already navigated away.
 */
export type ReadingPhase =
  | { kind: 'scanning' }
  | { kind: 'breathing'; deviceId: string }
  | { kind: 'recording'; deviceId: string }
  | { kind: 'complete' };

type FlowAction =
  | { type: 'SELECT'; deviceId: string; skipBreathing: boolean }
  | { type: 'BREATHING_DONE' }
  | { type: 'RECORDING_DONE' }
  | { type: 'RESET' };

/** Initial phase state — exported for testing only. */
export const INITIAL_PHASE: ReadingPhase = { kind: 'scanning' };

/**
 * Pure reducer used by {@link useReadingFlow}. Exported separately so it
 * can be unit-tested without a React renderer.
 */
export function readingFlowReducer(state: ReadingPhase, action: FlowAction): ReadingPhase {
  switch (action.type) {
    case 'SELECT':
      // Only valid from scanning; ignore double-taps after we've moved on.
      if (state.kind !== 'scanning') return state;
      return action.skipBreathing
        ? { kind: 'recording', deviceId: action.deviceId }
        : { kind: 'breathing', deviceId: action.deviceId };
    case 'BREATHING_DONE':
      if (state.kind !== 'breathing') return state;
      return { kind: 'recording', deviceId: state.deviceId };
    case 'RECORDING_DONE':
      if (state.kind !== 'recording') return state;
      return { kind: 'complete' };
    case 'RESET':
      return INITIAL_PHASE;
    default:
      return state;
  }
}

export interface UseReadingFlow {
  phase: ReadingPhase;
  selectDevice: (deviceId: string, skipBreathing: boolean) => void;
  finishBreathing: () => void;
  finishRecording: () => void;
  reset: () => void;
}

export function useReadingFlow(): UseReadingFlow {
  const [phase, dispatch] = useReducer(readingFlowReducer, INITIAL_PHASE);

  const selectDevice = useCallback(
    (deviceId: string, skipBreathing: boolean) =>
      dispatch({ type: 'SELECT', deviceId, skipBreathing }),
    []
  );
  const finishBreathing = useCallback(() => dispatch({ type: 'BREATHING_DONE' }), []);
  const finishRecording = useCallback(() => dispatch({ type: 'RECORDING_DONE' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return { phase, selectDevice, finishBreathing, finishRecording, reset };
}
