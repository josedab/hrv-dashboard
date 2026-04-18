import { readingFlowReducer, INITIAL_PHASE, ReadingPhase } from '../../src/hooks/useReadingFlow';

describe('readingFlowReducer', () => {
  describe('SELECT from scanning', () => {
    it('skipBreathing=false transitions to breathing with deviceId', () => {
      const next = readingFlowReducer(INITIAL_PHASE, {
        type: 'SELECT',
        deviceId: 'aa:bb:cc',
        skipBreathing: false,
      });
      expect(next).toEqual({ kind: 'breathing', deviceId: 'aa:bb:cc' });
    });

    it('skipBreathing=true transitions directly to recording with deviceId', () => {
      const next = readingFlowReducer(INITIAL_PHASE, {
        type: 'SELECT',
        deviceId: 'dd:ee:ff',
        skipBreathing: true,
      });
      expect(next).toEqual({ kind: 'recording', deviceId: 'dd:ee:ff' });
    });

    it('SELECT is a no-op when not in scanning', () => {
      const breathing: ReadingPhase = { kind: 'breathing', deviceId: 'aa' };
      const next = readingFlowReducer(breathing, {
        type: 'SELECT',
        deviceId: 'bb',
        skipBreathing: false,
      });
      expect(next).toBe(breathing);
    });
  });

  describe('BREATHING_DONE', () => {
    it('transitions from breathing to recording, preserving deviceId', () => {
      const breathing: ReadingPhase = { kind: 'breathing', deviceId: 'xx' };
      const next = readingFlowReducer(breathing, { type: 'BREATHING_DONE' });
      expect(next).toEqual({ kind: 'recording', deviceId: 'xx' });
    });

    it('is a no-op when not in breathing', () => {
      const next = readingFlowReducer(INITIAL_PHASE, { type: 'BREATHING_DONE' });
      expect(next).toBe(INITIAL_PHASE);
    });
  });

  describe('RECORDING_DONE', () => {
    it('transitions from recording to complete', () => {
      const rec: ReadingPhase = { kind: 'recording', deviceId: 'yy' };
      const next = readingFlowReducer(rec, { type: 'RECORDING_DONE' });
      expect(next).toEqual({ kind: 'complete' });
    });

    it('is a no-op when not in recording', () => {
      const next = readingFlowReducer(INITIAL_PHASE, { type: 'RECORDING_DONE' });
      expect(next).toBe(INITIAL_PHASE);
    });

    it('is a no-op when already complete (cannot re-fire)', () => {
      const complete: ReadingPhase = { kind: 'complete' };
      const next = readingFlowReducer(complete, { type: 'RECORDING_DONE' });
      expect(next).toBe(complete);
    });
  });

  describe('RESET', () => {
    it('resets from any phase to scanning', () => {
      const phases: ReadingPhase[] = [
        { kind: 'breathing', deviceId: 'a' },
        { kind: 'recording', deviceId: 'b' },
        { kind: 'complete' },
      ];
      for (const p of phases) {
        expect(readingFlowReducer(p, { type: 'RESET' })).toEqual(INITIAL_PHASE);
      }
    });
  });

  describe('full happy-path sequence', () => {
    it('walks scanning → breathing → recording → complete', () => {
      let s: ReadingPhase = INITIAL_PHASE;
      s = readingFlowReducer(s, { type: 'SELECT', deviceId: 'h10', skipBreathing: false });
      expect(s.kind).toBe('breathing');
      s = readingFlowReducer(s, { type: 'BREATHING_DONE' });
      expect(s).toEqual({ kind: 'recording', deviceId: 'h10' });
      s = readingFlowReducer(s, { type: 'RECORDING_DONE' });
      expect(s).toEqual({ kind: 'complete' });
    });

    it('walks scanning → recording → complete when breathing is skipped', () => {
      let s: ReadingPhase = INITIAL_PHASE;
      s = readingFlowReducer(s, { type: 'SELECT', deviceId: 'h10', skipBreathing: true });
      expect(s).toEqual({ kind: 'recording', deviceId: 'h10' });
      s = readingFlowReducer(s, { type: 'RECORDING_DONE' });
      expect(s).toEqual({ kind: 'complete' });
    });
  });
});
