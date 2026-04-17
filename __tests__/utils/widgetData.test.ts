jest.mock('../../src/database/database', () => ({
  getDatabase: jest.fn(),
}));
jest.mock('../../src/database/sessionRepository', () => ({
  getTodaySession: jest.fn(),
  getDailyReadings: jest.fn(),
}));
jest.mock('../../src/database/settingsRepository', () => ({
  loadSettings: jest.fn(),
}));

import { getWidgetData, refreshWidget } from '../../src/utils/widgetData';
import { getDatabase } from '../../src/database/database';
import { getTodaySession, getDailyReadings } from '../../src/database/sessionRepository';
import { loadSettings } from '../../src/database/settingsRepository';
import { DEFAULT_SETTINGS, Session } from '../../src/types';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-id',
    timestamp: '2026-04-15T06:30:00Z',
    durationSeconds: 300,
    rrIntervals: [800, 810, 795],
    rmssd: 42,
    sdnn: 20,
    meanHr: 65,
    pnn50: 15,
    artifactRate: 0.02,
    verdict: 'go_hard',
    perceivedReadiness: null,
    trainingType: null,
    notes: null,
    sleepHours: null,
    sleepQuality: null,
    stressLevel: null,
    source: 'chest_strap',
    ...overrides,
  };
}

describe('getWidgetData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns no-reading state when no session today', async () => {
    (loadSettings as jest.Mock).mockResolvedValue(DEFAULT_SETTINGS);
    (getTodaySession as jest.Mock).mockResolvedValue(null);
    (getDailyReadings as jest.Mock).mockResolvedValue([]);

    const mockDb = {
      getAllAsync: jest.fn().mockResolvedValue([]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const data = await getWidgetData();

    expect(data.hasReading).toBe(false);
    expect(data.verdict).toBeNull();
    expect(data.rmssd).toBeNull();
  });

  it('includes today verdict and rMSSD when session exists', async () => {
    const session = makeSession({ verdict: 'moderate', rmssd: 38 });
    (loadSettings as jest.Mock).mockResolvedValue(DEFAULT_SETTINGS);
    (getTodaySession as jest.Mock).mockResolvedValue(session);
    (getDailyReadings as jest.Mock).mockResolvedValue([
      { date: '2026-04-10', rmssd: 40, verdict: 'go_hard' },
      { date: '2026-04-11', rmssd: 42, verdict: 'go_hard' },
      { date: '2026-04-12', rmssd: 38, verdict: 'moderate' },
      { date: '2026-04-13', rmssd: 41, verdict: 'go_hard' },
      { date: '2026-04-14', rmssd: 39, verdict: 'moderate' },
    ]);

    const mockDb = {
      getAllAsync: jest
        .fn()
        .mockResolvedValueOnce([]) // session dates
        .mockResolvedValueOnce([{ rmssd: 38 }]), // recent rMSSD
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const data = await getWidgetData();

    expect(data.hasReading).toBe(true);
    expect(data.verdict).toBe('moderate');
    expect(data.rmssd).toBe(38);
  });

  it('computes percentage of baseline when baseline is sufficient', async () => {
    const session = makeSession({ rmssd: 40 });
    (loadSettings as jest.Mock).mockResolvedValue(DEFAULT_SETTINGS);
    (getTodaySession as jest.Mock).mockResolvedValue(session);
    // Build readings relative to today so the rolling-window cutoff includes them.
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const today = new Date();
    const readings = [1, 2, 3, 4, 5].map((daysAgo) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);
      return { date: fmt(d), rmssd: 40, verdict: 'go_hard' as const };
    });
    (getDailyReadings as jest.Mock).mockResolvedValue(readings);

    const mockDb = {
      getAllAsync: jest.fn().mockResolvedValue([]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const data = await getWidgetData();

    expect(data.baselineMedian).toBe(40);
    expect(data.percentOfBaseline).toBe(100);
  });

  it('returns null baseline when fewer than 5 days', async () => {
    const session = makeSession();
    (loadSettings as jest.Mock).mockResolvedValue(DEFAULT_SETTINGS);
    (getTodaySession as jest.Mock).mockResolvedValue(session);
    (getDailyReadings as jest.Mock).mockResolvedValue([
      { date: '2026-04-14', rmssd: 40, verdict: 'go_hard' },
      { date: '2026-04-15', rmssd: 42, verdict: 'go_hard' },
    ]);

    const mockDb = {
      getAllAsync: jest.fn().mockResolvedValue([]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const data = await getWidgetData();

    expect(data.baselineMedian).toBeNull();
    expect(data.percentOfBaseline).toBeNull();
  });

  it('populates sparkline values from recent sessions', async () => {
    (loadSettings as jest.Mock).mockResolvedValue(DEFAULT_SETTINGS);
    (getTodaySession as jest.Mock).mockResolvedValue(null);
    (getDailyReadings as jest.Mock).mockResolvedValue([]);

    const mockDb = {
      getAllAsync: jest
        .fn()
        .mockResolvedValueOnce([]) // session dates
        .mockResolvedValueOnce([{ rmssd: 45 }, { rmssd: 42 }, { rmssd: 38 }]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const data = await getWidgetData();

    expect(data.sparklineValues).toEqual([38, 42, 45]);
  });

  it('includes updatedAt timestamp', async () => {
    (loadSettings as jest.Mock).mockResolvedValue(DEFAULT_SETTINGS);
    (getTodaySession as jest.Mock).mockResolvedValue(null);
    (getDailyReadings as jest.Mock).mockResolvedValue([]);

    const mockDb = {
      getAllAsync: jest.fn().mockResolvedValue([]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const data = await getWidgetData();

    expect(data.updatedAt).toBeDefined();
    expect(new Date(data.updatedAt).getTime()).not.toBeNaN();
  });

  it('returns safe defaults on error', async () => {
    (loadSettings as jest.Mock).mockRejectedValue(new Error('DB error'));

    const data = await getWidgetData();

    expect(data.hasReading).toBe(false);
    expect(data.verdict).toBeNull();
    expect(data.streak).toBe(0);
    expect(data.sparklineValues).toEqual([]);
  });
});

describe('refreshWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists widget data to the settings table', async () => {
    (loadSettings as jest.Mock).mockResolvedValue(DEFAULT_SETTINGS);
    (getTodaySession as jest.Mock).mockResolvedValue(null);
    (getDailyReadings as jest.Mock).mockResolvedValue([]);

    const mockDb = {
      getAllAsync: jest.fn().mockResolvedValue([]),
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    await refreshWidget();

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO settings'),
      'widget_data',
      expect.any(String)
    );

    const storedJson = mockDb.runAsync.mock.calls[0][2];
    const parsed = JSON.parse(storedJson);
    expect(parsed.hasReading).toBe(false);
    expect(parsed.updatedAt).toBeDefined();
  });
});
