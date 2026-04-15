import { useState, useCallback, useRef, useEffect } from 'react';
import { HeartRateMeasurement } from './heartRateParser';
import { connectAndSubscribe, BleConnectionState } from './bleManager';
import { RECORDING_DURATION_SECONDS, MIN_RECORDING_SECONDS } from '../constants/defaults';

/**
 * Current state of an active BLE recording session.
 * Tracks connection, timing, accumulated data, and errors.
 */
export interface RecordingState {
  connectionState: BleConnectionState;
  isRecording: boolean;
  rrIntervals: number[];
  heartRates: number[];
  currentHr: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  canFinishEarly: boolean;
  error: string | null;
}

/**
 * Actions to control the BLE recording lifecycle.
 */
export interface RecordingActions {
  startRecording: (deviceId: string) => Promise<void>;
  stopRecording: () => void;
  resetRecording: () => void;
}

const INITIAL_STATE: RecordingState = {
  connectionState: 'disconnected',
  isRecording: false,
  rrIntervals: [],
  heartRates: [],
  currentHr: 0,
  elapsedSeconds: 0,
  remainingSeconds: RECORDING_DURATION_SECONDS,
  canFinishEarly: false,
  error: null,
};

/**
 * React hook managing the full BLE recording lifecycle.
 *
 * Handles device connection, RR interval accumulation, elapsed/remaining
 * time tracking, early finish eligibility, and automatic stop at the
 * configured duration limit. Cleans up BLE connection on unmount.
 *
 * @returns Tuple of `[RecordingState, RecordingActions]`
 *
 * @example
 * ```tsx
 * const [state, actions] = useBleRecording();
 * await actions.startRecording(deviceId);
 * // state.rrIntervals accumulates over time
 * // state.canFinishEarly becomes true after MIN_RECORDING_SECONDS
 * actions.stopRecording(); // or auto-stops at RECORDING_DURATION_SECONDS
 * ```
 */
export function useBleRecording(): [RecordingState, RecordingActions] {
  const [state, setState] = useState<RecordingState>(INITIAL_STATE);
  const cleanupRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const rrIntervalsRef = useRef<number[]>([]);
  const heartRatesRef = useRef<number[]>([]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    clearTimer();
    cleanupRef.current?.();
    cleanupRef.current = null;

    setState((prev) => ({
      ...prev,
      isRecording: false,
      connectionState: 'disconnected',
    }));
  }, [clearTimer]);

  const resetRecording = useCallback(() => {
    stopRecording();
    rrIntervalsRef.current = [];
    heartRatesRef.current = [];
    setState(INITIAL_STATE);
  }, [stopRecording]);

  const startRecording = useCallback(async (deviceId: string) => {
    resetRecording();
    startTimeRef.current = Date.now();
    rrIntervalsRef.current = [];
    heartRatesRef.current = [];

    setState((prev) => ({
      ...prev,
      isRecording: true,
      error: null,
    }));

    // Start elapsed time counter
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const remaining = Math.max(0, RECORDING_DURATION_SECONDS - elapsed);
      const canFinish = elapsed >= MIN_RECORDING_SECONDS;

      setState((prev) => ({
        ...prev,
        elapsedSeconds: elapsed,
        remainingSeconds: remaining,
        canFinishEarly: canFinish,
      }));

      // Auto-stop at duration limit
      if (remaining <= 0) {
        stopRecording();
      }
    }, 1000);

    try {
      const cleanup = await connectAndSubscribe(deviceId, {
        onStateChange: (connectionState) => {
          setState((prev) => ({ ...prev, connectionState }));
        },
        onHeartRateMeasurement: (measurement: HeartRateMeasurement) => {
          if (measurement.rrIntervals.length > 0) {
            rrIntervalsRef.current.push(...measurement.rrIntervals);
          }
          heartRatesRef.current.push(measurement.heartRate);

          setState((prev) => ({
            ...prev,
            rrIntervals: [...rrIntervalsRef.current],
            heartRates: [...heartRatesRef.current],
            currentHr: measurement.heartRate,
          }));
        },
        onError: (error) => {
          setState((prev) => ({ ...prev, error }));
        },
      });
      cleanupRef.current = cleanup;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect';
      setState((prev) => ({
        ...prev,
        isRecording: false,
        connectionState: 'error',
        error: message,
      }));
      clearTimer();
    }
  }, [resetRecording, stopRecording, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      cleanupRef.current?.();
    };
  }, [clearTimer]);

  return [state, { startRecording, stopRecording, resetRecording }];
}
