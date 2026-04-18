// Tests the pure `finalizeSession` workflow extracted from
// useSessionPersistence. Focus: fixed-vs-adaptive verdictMode branching,
// chest-strap-only history filter, error handling.

// Stub @react-navigation/native because importing the hook module pulls
// it in transitively (ESM-only package, untransformed by ts-jest).
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ replace: jest.fn() }),
}));

const saveSessionMock = jest.fn();
const getDailyReadingsMock = jest.fn();
const getRecentSessionsMock = jest.fn();
jest.mock('../../src/database/sessionRepository', () => ({
  saveSession: (...args: unknown[]) => saveSessionMock(...args),
  getDailyReadings: (...args: unknown[]) => getDailyReadingsMock(...args),
  getRecentSessions: (...args: unknown[]) => getRecentSessionsMock(...args),
}));

const loadSettingsMock = jest.fn();
jest.mock('../../src/database/settingsRepository', () => ({
  loadSettings: () => loadSettingsMock(),
}));

const refreshWidgetMock = jest.fn().mockResolvedValue(undefined);
jest.mock('../../src/utils/widgetData', () => ({
  refreshWidget: () => refreshWidgetMock(),
}));

jest.mock('../../src/utils/uuid', () => ({
  generateId: () => 'test-session-id',
}));

const computeVerdictMock = jest.fn();
jest.mock('../../src/hrv/verdict', () => ({
  computeVerdict: (...args: unknown[]) => computeVerdictMock(...args),
}));

const computeAdaptiveVerdictMock = jest.fn();
jest.mock('../../src/hrv/adaptiveThresholds', () => ({
  computeAdaptiveVerdict: (...args: unknown[]) => computeAdaptiveVerdictMock(...args),
}));

import { finalizeSession } from '../../src/hooks/useSessionPersistence';
import { DEFAULT_SETTINGS } from '../../src/types';

describe('finalizeSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    saveSessionMock.mockResolvedValue(undefined);
    getDailyReadingsMock.mockResolvedValue([]);
    getRecentSessionsMock.mockResolvedValue([]);
  });

  // RR intervals chosen to produce a real (non-NaN) rmssd; the verdict
  // itself is mocked, so the exact value doesn't matter.
  const rrIntervals = Array.from({ length: 200 }, (_, i) => 800 + (i % 5) * 10);

  it('uses computeVerdict in fixed mode and does NOT load history', async () => {
    loadSettingsMock.mockResolvedValue({ ...DEFAULT_SETTINGS, verdictMode: 'fixed' });
    computeVerdictMock.mockReturnValue('go_hard');
    const onSaved = jest.fn();

    const result = await finalizeSession(
      { rrIntervals, durationSeconds: 120, source: 'chest_strap' },
      onSaved
    );

    expect(result.kind).toBe('saved');
    expect(computeVerdictMock).toHaveBeenCalledTimes(1);
    expect(computeAdaptiveVerdictMock).not.toHaveBeenCalled();
    expect(getRecentSessionsMock).not.toHaveBeenCalled();
    expect(saveSessionMock).toHaveBeenCalledTimes(1);
    const saved = saveSessionMock.mock.calls[0][0];
    expect(saved.verdict).toBe('go_hard');
    expect(saved.source).toBe('chest_strap');
    expect(onSaved).toHaveBeenCalledWith('test-session-id');
  });

  it('uses computeAdaptiveVerdict in adaptive mode and filters camera sessions out of history', async () => {
    loadSettingsMock.mockResolvedValue({ ...DEFAULT_SETTINGS, verdictMode: 'adaptive' });
    getRecentSessionsMock.mockResolvedValue([
      { id: 'a', source: 'chest_strap', rmssd: 50 },
      { id: 'b', source: 'camera', rmssd: 30 }, // must be filtered
      { id: 'c', source: 'chest_strap', rmssd: 60 },
    ]);
    computeAdaptiveVerdictMock.mockReturnValue({
      verdict: 'moderate',
      cutoffs: { rest: 30, hard: 55 },
      coldStart: false,
      historyN: 30,
    });
    const onSaved = jest.fn();

    const result = await finalizeSession(
      { rrIntervals, durationSeconds: 120, source: 'chest_strap' },
      onSaved
    );

    expect(result.kind).toBe('saved');
    expect(computeAdaptiveVerdictMock).toHaveBeenCalledTimes(1);
    expect(computeVerdictMock).not.toHaveBeenCalled();

    const historyArg = computeAdaptiveVerdictMock.mock.calls[0][1] as Array<{
      id: string;
      source: string;
    }>;
    expect(historyArg.map((s) => s.id)).toEqual(['a', 'c']);

    const saved = saveSessionMock.mock.calls[0][0];
    expect(saved.verdict).toBe('moderate');
    expect(onSaved).toHaveBeenCalledWith('test-session-id');
  });

  it('returns an error result and does not invoke onSaved when saveSession throws', async () => {
    loadSettingsMock.mockResolvedValue({ ...DEFAULT_SETTINGS, verdictMode: 'fixed' });
    computeVerdictMock.mockReturnValue('rest');
    saveSessionMock.mockRejectedValue(new Error('disk full'));
    const onSaved = jest.fn();
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await finalizeSession(
      { rrIntervals, durationSeconds: 120, source: 'chest_strap' },
      onSaved
    );

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.error.message).toBe('disk full');
    }
    expect(onSaved).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('passes the camera source through to the saved session', async () => {
    loadSettingsMock.mockResolvedValue({ ...DEFAULT_SETTINGS, verdictMode: 'fixed' });
    computeVerdictMock.mockReturnValue(null);
    const onSaved = jest.fn();

    await finalizeSession({ rrIntervals, durationSeconds: 90, source: 'camera' }, onSaved);

    const saved = saveSessionMock.mock.calls[0][0];
    expect(saved.source).toBe('camera');
    expect(saved.verdict).toBeNull();
  });
});
