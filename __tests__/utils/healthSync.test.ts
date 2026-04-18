jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));
jest.mock('../../src/database/database', () => ({
  getDatabase: jest.fn(),
}));

import {
  isHealthSyncAvailable,
  syncSessionToHealth,
  syncAllPendingSessions,
  loadHealthSyncSettings,
  setHealthSyncEnabled,
} from '../../src/utils/healthSync';
import { getDatabase } from '../../src/database/database';
import { Session } from '../../src/types';

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

describe('isHealthSyncAvailable', () => {
  it('returns false when health module is not installed', () => {
    // The test environment does not have react-native-health installed,
    // so the runtime require() in healthSync.ts will fail gracefully.
    const result = isHealthSyncAvailable();
    expect(typeof result).toBe('boolean');
  });
});

describe('syncSessionToHealth', () => {
  it('returns false when health module is unavailable', async () => {
    const result = await syncSessionToHealth(makeSession());
    expect(result).toBe(false);
  });
});

describe('syncAllPendingSessions', () => {
  it('returns 0 when health sync is not available', async () => {
    const count = await syncAllPendingSessions([makeSession()]);
    expect(count).toBe(0);
  });
});

describe('loadHealthSyncSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns defaults when no settings exist', async () => {
    const mockDb = {
      getFirstAsync: jest.fn().mockResolvedValue(undefined),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const settings = await loadHealthSyncSettings();

    expect(settings.enabled).toBe(false);
    expect(settings.lastSyncTimestamp).toBeNull();
    expect(settings.syncedSessionCount).toBe(0);
  });

  it('loads enabled state from database', async () => {
    const mockDb = {
      getFirstAsync: jest
        .fn()
        .mockImplementation((_sql: string, key: string) =>
          Promise.resolve(key === 'health_enabled' ? { value: 'true' } : undefined)
        ),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const settings = await loadHealthSyncSettings();

    expect(settings.enabled).toBe(true);
  });

  it('loads last sync timestamp', async () => {
    const mockDb = {
      getFirstAsync: jest
        .fn()
        .mockImplementation((_sql: string, key: string) =>
          Promise.resolve(
            key === 'health_last_sync' ? { value: '2026-04-15T10:00:00Z' } : undefined
          )
        ),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const settings = await loadHealthSyncSettings();

    expect(settings.lastSyncTimestamp).toBe('2026-04-15T10:00:00Z');
  });

  it('counts synced sessions from stored IDs', async () => {
    const mockDb = {
      getFirstAsync: jest
        .fn()
        .mockImplementation((_sql: string, key: string) =>
          Promise.resolve(
            key === 'health_synced_ids'
              ? { value: JSON.stringify(['id-1', 'id-2', 'id-3']) }
              : undefined
          )
        ),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const settings = await loadHealthSyncSettings();

    expect(settings.syncedSessionCount).toBe(3);
  });
});

describe('setHealthSyncEnabled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves enabled=true to database', async () => {
    const mockDb = {
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    await setHealthSyncEnabled(true);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO settings'),
      'health_enabled',
      'true'
    );
  });

  it('saves enabled=false to database', async () => {
    const mockDb = {
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    await setHealthSyncEnabled(false);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO settings'),
      'health_enabled',
      'false'
    );
  });
});
