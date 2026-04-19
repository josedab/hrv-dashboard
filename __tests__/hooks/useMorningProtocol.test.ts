import {
  getPhaseSequence,
  shouldAutoAdvance,
  computeProtocolState,
  DEFAULT_PROTOCOL_CONFIG,
  QUICK_PROTOCOL_CONFIG,
  ProtocolConfig,
} from '../../src/hooks/useMorningProtocol';

describe('getPhaseSequence', () => {
  it('includes breathing when duration > 0', () => {
    const phases = getPhaseSequence(DEFAULT_PROTOCOL_CONFIG);
    expect(phases).toEqual(['breathing', 'recording', 'log', 'complete']);
  });

  it('skips breathing when duration is 0', () => {
    const phases = getPhaseSequence(QUICK_PROTOCOL_CONFIG);
    expect(phases).toEqual(['recording', 'log', 'complete']);
  });

  it('skips log when showLog is false', () => {
    const config: ProtocolConfig = { ...DEFAULT_PROTOCOL_CONFIG, showLog: false };
    const phases = getPhaseSequence(config);
    expect(phases).toEqual(['breathing', 'recording', 'complete']);
  });

  it('always ends with complete', () => {
    const phases = getPhaseSequence(DEFAULT_PROTOCOL_CONFIG);
    expect(phases[phases.length - 1]).toBe('complete');
  });
});

describe('shouldAutoAdvance', () => {
  it('advances breathing when elapsed >= duration', () => {
    expect(shouldAutoAdvance('breathing', 120, DEFAULT_PROTOCOL_CONFIG)).toBe(true);
    expect(shouldAutoAdvance('breathing', 119, DEFAULT_PROTOCOL_CONFIG)).toBe(false);
  });

  it('advances recording when elapsed >= duration', () => {
    expect(shouldAutoAdvance('recording', 300, DEFAULT_PROTOCOL_CONFIG)).toBe(true);
    expect(shouldAutoAdvance('recording', 299, DEFAULT_PROTOCOL_CONFIG)).toBe(false);
  });

  it('never auto-advances log or complete', () => {
    expect(shouldAutoAdvance('log', 9999, DEFAULT_PROTOCOL_CONFIG)).toBe(false);
    expect(shouldAutoAdvance('complete', 9999, DEFAULT_PROTOCOL_CONFIG)).toBe(false);
  });
});

describe('computeProtocolState', () => {
  const phases = getPhaseSequence(DEFAULT_PROTOCOL_CONFIG);

  it('returns correct state for breathing phase', () => {
    const state = computeProtocolState(phases, 0, 60, DEFAULT_PROTOCOL_CONFIG);
    expect(state.phase).toBe('breathing');
    expect(state.stepNumber).toBe(1);
    expect(state.totalSteps).toBe(3); // breathing + recording + log
    expect(state.phaseRemaining).toBe(60);
    expect(state.phaseProgress).toBe(0.5);
    expect(state.canAdvance).toBe(true); // breathing always skippable
  });

  it('returns correct state for recording phase', () => {
    const state = computeProtocolState(phases, 1, 150, DEFAULT_PROTOCOL_CONFIG);
    expect(state.phase).toBe('recording');
    expect(state.stepNumber).toBe(2);
    expect(state.phaseRemaining).toBe(150);
    expect(state.canAdvance).toBe(true); // >= 120s
  });

  it('recording cannot be advanced early before 2 minutes', () => {
    const state = computeProtocolState(phases, 1, 60, DEFAULT_PROTOCOL_CONFIG);
    expect(state.canAdvance).toBe(false);
  });

  it('log phase is always advanceable', () => {
    const state = computeProtocolState(phases, 2, 0, DEFAULT_PROTOCOL_CONFIG);
    expect(state.phase).toBe('log');
    expect(state.canAdvance).toBe(true);
    expect(state.phaseRemaining).toBe(0);
  });

  it('complete phase has correct step number', () => {
    const state = computeProtocolState(phases, 3, 0, DEFAULT_PROTOCOL_CONFIG);
    expect(state.phase).toBe('complete');
    expect(state.stepNumber).toBe(3);
  });

  it('clamps progress to 1.0', () => {
    const state = computeProtocolState(phases, 0, 999, DEFAULT_PROTOCOL_CONFIG);
    expect(state.phaseProgress).toBe(1);
  });

  it('handles out-of-bounds phase index', () => {
    const state = computeProtocolState(phases, 99, 0, DEFAULT_PROTOCOL_CONFIG);
    expect(state.phase).toBe('complete');
  });
});
