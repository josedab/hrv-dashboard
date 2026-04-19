import {
  processRecording,
  recordingReducer,
  getInitialRecordingState,
} from '../../src/hooks/useRecordingOrchestrator';

describe('processRecording', () => {
  it('returns hasEnoughData false for < 10 intervals', () => {
    const result = processRecording([800, 810, 790]);
    expect(result.hasEnoughData).toBe(false);
    expect(result.metrics.rmssd).toBe(0);
  });

  it('computes metrics for sufficient data', () => {
    const rr = Array.from({ length: 100 }, (_, i) => 800 + (i % 5) * 10);
    const result = processRecording(rr);
    expect(result.hasEnoughData).toBe(true);
    expect(result.metrics.rmssd).toBeGreaterThan(0);
    expect(result.cleanIntervals.length).toBeGreaterThan(0);
  });

  it('applies tolerance factor', () => {
    // Include an outlier that's borderline at default threshold
    const rr = [800, 810, 600, 790, 805, 810, 795, 800, 808, 803];
    const strict = processRecording(rr, 1.0);
    const lenient = processRecording(rr, 2.0);
    // Lenient should keep more intervals (fewer artifacts)
    expect(lenient.cleanIntervals.length).toBeGreaterThanOrEqual(strict.cleanIntervals.length);
  });
});

describe('recordingReducer', () => {
  it('transitions idle → scanning on START_SCAN', () => {
    const state = getInitialRecordingState();
    const next = recordingReducer(state, { type: 'START_SCAN' });
    expect(next.phase).toBe('scanning');
  });

  it('transitions scanning → connecting on CONNECT', () => {
    const state = { ...getInitialRecordingState(), phase: 'scanning' as const };
    const next = recordingReducer(state, { type: 'CONNECT' });
    expect(next.phase).toBe('connecting');
  });

  it('transitions connecting → recording on CONNECTED', () => {
    const state = { ...getInitialRecordingState(), phase: 'connecting' as const };
    const next = recordingReducer(state, { type: 'CONNECTED' });
    expect(next.phase).toBe('recording');
  });

  it('accumulates RR_DATA during recording', () => {
    let state: ReturnType<typeof getInitialRecordingState> = {
      ...getInitialRecordingState(),
      phase: 'recording',
    };
    state = recordingReducer(state, { type: 'RR_DATA', intervals: [800, 810] });
    state = recordingReducer(state, { type: 'RR_DATA', intervals: [790] });
    expect(state.rrIntervals).toEqual([800, 810, 790]);
  });

  it('transitions recording → processing on STOP_RECORDING', () => {
    const state = { ...getInitialRecordingState(), phase: 'recording' as const };
    const next = recordingReducer(state, { type: 'STOP_RECORDING' });
    expect(next.phase).toBe('processing');
  });

  it('PROCESS computes metrics and transitions to complete', () => {
    const rr = Array.from({ length: 100 }, (_, i) => 800 + (i % 5) * 10);
    const state = {
      ...getInitialRecordingState(),
      phase: 'processing' as const,
      rrIntervals: rr,
    };
    const next = recordingReducer(state, { type: 'PROCESS' });
    expect(next.phase).toBe('complete');
    expect(next.metrics).not.toBeNull();
    expect(next.metrics!.rmssd).toBeGreaterThan(0);
  });

  it('transitions to error on ERROR', () => {
    const state = getInitialRecordingState();
    const next = recordingReducer(state, { type: 'ERROR', message: 'BLE failed' });
    expect(next.phase).toBe('error');
    expect(next.error).toBe('BLE failed');
  });

  it('RESET returns to initial state', () => {
    const state = {
      ...getInitialRecordingState(),
      phase: 'complete' as const,
      rrIntervals: [800],
    };
    const next = recordingReducer(state, { type: 'RESET' });
    expect(next.phase).toBe('idle');
    expect(next.rrIntervals).toEqual([]);
  });
});
