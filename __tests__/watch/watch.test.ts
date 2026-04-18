jest.mock('../../src/database/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../../src/database/sessionRepository', () => ({
  saveSession: jest.fn(),
  getDailyReadings: jest.fn(),
}));
jest.mock('../../src/database/settingsRepository', () => ({ loadSettings: jest.fn() }));

import {
  WATCH_BRIDGE_VERSION,
  validateWatchPayload,
  ingestWatchSession,
  buildComplicationSnapshot,
  WatchSessionPayload,
} from '../../src/experimental/watch';
import { GOLDEN_VECTORS, GOLDEN_TOLERANCE_MS } from '../../src/experimental/watch/goldenVectors';
import { computeHrvMetrics } from '../../src/hrv/metrics';
import { saveSession, getDailyReadings } from '../../src/database/sessionRepository';
import { loadSettings } from '../../src/database/settingsRepository';
import { DEFAULT_SETTINGS, Session } from '../../src/types';

const mockedSave = saveSession as jest.MockedFunction<typeof saveSession>;
const mockedGetReadings = getDailyReadings as jest.MockedFunction<typeof getDailyReadings>;
const mockedLoadSettings = loadSettings as jest.MockedFunction<typeof loadSettings>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedLoadSettings.mockResolvedValue(DEFAULT_SETTINGS);
  mockedGetReadings.mockResolvedValue([]);
  mockedSave.mockResolvedValue(undefined);
});

function makePayload(overrides: Partial<WatchSessionPayload> = {}): WatchSessionPayload {
  return {
    bridgeVersion: WATCH_BRIDGE_VERSION,
    timestamp: '2026-04-15T06:30:00Z',
    durationSeconds: 300,
    rrIntervals: Array(60).fill(900),
    source: 'watchos',
    ...overrides,
  };
}

describe('validateWatchPayload', () => {
  it('accepts a well-formed payload', () => {
    expect(() => validateWatchPayload(makePayload())).not.toThrow();
  });

  it('rejects mismatched bridge version', () => {
    expect(() => validateWatchPayload(makePayload({ bridgeVersion: 99 }))).toThrow(
      /Bridge version/
    );
  });

  it('rejects invalid timestamps', () => {
    expect(() => validateWatchPayload(makePayload({ timestamp: 'tomorrow' }))).toThrow(/ISO 8601/);
  });

  it('rejects too few RR intervals', () => {
    expect(() => validateWatchPayload(makePayload({ rrIntervals: [800, 900] }))).toThrow(/30/);
  });

  it('rejects unknown source', () => {
    expect(() => validateWatchPayload(makePayload({ source: 'fitbit' as 'watchos' }))).toThrow(
      /source/
    );
  });
});

describe('ingestWatchSession', () => {
  it('persists a watch session and returns rmssd + verdict', async () => {
    const result = await ingestWatchSession(makePayload());
    expect(mockedSave).toHaveBeenCalledTimes(1);
    expect(result.duplicate).toBe(false);
    expect(result.rmssd).toBeGreaterThanOrEqual(0);
    const saved = mockedSave.mock.calls[0][0] as Session;
    expect(saved.source).toBe('camera');
  });

  it('returns duplicate=true when save throws UNIQUE constraint', async () => {
    mockedSave.mockRejectedValueOnce(new Error('UNIQUE constraint failed: sessions.id'));
    const result = await ingestWatchSession(makePayload({ clientSessionId: 'dup-1' }));
    expect(result.duplicate).toBe(true);
    expect(result.sessionId).toBe('dup-1');
  });

  it('rethrows non-constraint errors', async () => {
    mockedSave.mockRejectedValueOnce(new Error('disk full'));
    await expect(ingestWatchSession(makePayload())).rejects.toThrow(/disk full/);
  });
});

describe('buildComplicationSnapshot', () => {
  const session: Session = {
    id: 's1',
    timestamp: '2026-04-15T06:30:00Z',
    durationSeconds: 300,
    rrIntervals: [800],
    rmssd: 42,
    sdnn: 25,
    meanHr: 60,
    pnn50: 10,
    artifactRate: 0,
    verdict: 'moderate',
    perceivedReadiness: null,
    trainingType: null,
    notes: null,
    sleepHours: null,
    sleepQuality: null,
    stressLevel: null,
    source: 'chest_strap',
  };

  it('computes percent of baseline when both available', () => {
    const snap = buildComplicationSnapshot(session, 50, 7);
    expect(snap.percentOfBaseline).toBe(84);
    expect(snap.verdict).toBe('moderate');
    expect(snap.bridgeVersion).toBe(WATCH_BRIDGE_VERSION);
  });

  it('returns nulls when no session', () => {
    const snap = buildComplicationSnapshot(null, 50, 7);
    expect(snap.percentOfBaseline).toBeNull();
    expect(snap.verdict).toBeNull();
  });

  it('returns null baseline when zero', () => {
    const snap = buildComplicationSnapshot(session, 0, 0);
    expect(snap.baselineMedian).toBeNull();
    expect(snap.percentOfBaseline).toBeNull();
  });
});

describe('golden vectors', () => {
  it.each(GOLDEN_VECTORS)('matches expected metrics for $name', (vector) => {
    const m = computeHrvMetrics(vector.rrIntervals);
    expect(Math.abs(m.rmssd - vector.expected.rmssd)).toBeLessThan(GOLDEN_TOLERANCE_MS);
    expect(Math.abs(m.sdnn - vector.expected.sdnn)).toBeLessThan(GOLDEN_TOLERANCE_MS);
    expect(Math.abs(m.meanHr - vector.expected.meanHr)).toBeLessThan(0.001);
    expect(Math.abs(m.pnn50 - vector.expected.pnn50)).toBeLessThan(0.001);
  });
});
