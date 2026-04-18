jest.mock('react-native', () => ({
  Share: {
    share: jest.fn(),
  },
}));
jest.mock('../../src/database/database', () => ({
  getDatabase: jest.fn(),
}));
jest.mock('../../src/utils/uuid', () => ({
  generateId: jest.fn(() => 'test-id-123'),
}));

import { Share } from 'react-native';
import {
  ensureProfilesTable,
  getProfiles,
  createProfile,
  setActiveProfile,
  deleteProfile,
  shareVerdict,
} from '../../src/utils/profiles';
import { getDatabase } from '../../src/database/database';
import { Session } from '../../src/types';

describe('ensureProfilesTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('executes CREATE TABLE IF NOT EXISTS', async () => {
    const mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    await ensureProfilesTable();

    expect(mockDb.execAsync).toHaveBeenCalled();
    const sql = mockDb.execAsync.mock.calls[0][0];
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS profiles');
  });
});

describe('createProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws on empty name', async () => {
    const mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    await expect(createProfile('')).rejects.toThrow('Profile name must be 1-100 characters');
  });

  it('throws on whitespace-only name', async () => {
    const mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    await expect(createProfile('   ')).rejects.toThrow('Profile name must be 1-100 characters');
  });

  it('throws on name exceeding 100 characters', async () => {
    const mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const longName = 'a'.repeat(101);
    await expect(createProfile(longName)).rejects.toThrow('Profile name must be 1-100 characters');
  });

  it('trims whitespace from name', async () => {
    const mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const result = await createProfile('  John Doe  ');

    expect(result.name).toBe('John Doe');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'John Doe'
    );
  });

  it('accepts name exactly 100 characters', async () => {
    const mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const name = 'a'.repeat(100);
    const result = await createProfile(name);

    expect(result.name).toBe(name);
  });

  it('accepts valid name and inserts into database', async () => {
    const mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const result = await createProfile('Alice');

    expect(result.id).toBe('test-id-123');
    expect(result.name).toBe('Alice');
    expect(result.isActive).toBe(false);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO profiles'),
      'test-id-123',
      'Alice'
    );
  });

  it('returns profile with createdAt timestamp', async () => {
    const mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const result = await createProfile('Bob');

    expect(result.createdAt).toBeDefined();
    expect(typeof result.createdAt).toBe('string');
  });
});

describe('getProfiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty array when no profiles exist', async () => {
    const mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getAllAsync: jest.fn().mockResolvedValue([]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const result = await getProfiles();

    expect(result).toEqual([]);
  });

  it('maps database rows to AthleteProfile objects', async () => {
    const mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getAllAsync: jest.fn().mockResolvedValue([
        {
          id: '1',
          name: 'Alice',
          is_active: 1,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Bob',
          is_active: 0,
          created_at: '2024-01-02T00:00:00Z',
        },
      ]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const result = await getProfiles();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: '1',
      name: 'Alice',
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
    });
    expect(result[1]).toEqual({
      id: '2',
      name: 'Bob',
      isActive: false,
      createdAt: '2024-01-02T00:00:00Z',
    });
  });

  it('orders profiles by name', async () => {
    const mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getAllAsync: jest.fn().mockResolvedValue([
        { id: '1', name: 'Alice', is_active: 0, created_at: '2024-01-01T00:00:00Z' },
        { id: '2', name: 'Bob', is_active: 0, created_at: '2024-01-02T00:00:00Z' },
      ]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    await getProfiles();

    expect(mockDb.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('ORDER BY name ASC'));
  });
});

describe('setActiveProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deactivates all profiles and activates the specified one', async () => {
    const mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(undefined),
      withTransactionAsync: jest.fn(async (fn) => fn()),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    await setActiveProfile('profile-1');

    expect(mockDb.withTransactionAsync).toHaveBeenCalled();
    expect(mockDb.runAsync).toHaveBeenCalledWith('UPDATE profiles SET is_active = 0');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'UPDATE profiles SET is_active = 1 WHERE id = ?',
      'profile-1'
    );
  });
});

describe('deleteProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes profile from database', async () => {
    const mockDb = {
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    await deleteProfile('profile-1');

    expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM profiles WHERE id = ?', 'profile-1');
  });
});

describe('shareVerdict', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('formats "go_hard" verdict with green emoji and label', async () => {
    const mockShare = Share.share as jest.Mock;
    mockShare.mockResolvedValue({ action: 'sharedAction' });

    const session: Session = {
      id: '1',
      timestamp: '2024-01-15T08:30:00Z',
      durationSeconds: 300,
      rrIntervals: [],
      rmssd: 45.2,
      sdnn: 60.1,
      meanHr: 70,
      pnn50: 15.5,
      artifactRate: 2.3,
      verdict: 'go_hard',
      perceivedReadiness: null,
      trainingType: null,
      notes: '',
      sleepHours: null,
      sleepQuality: null,
      stressLevel: null,
      source: 'chest_strap',
    };

    await shareVerdict(session);

    const call = mockShare.mock.calls[0][0];
    expect(call.message).toContain('🟢 HRV Readiness');
    expect(call.message).toContain('Verdict: Go Hard');
  });

  it('formats "moderate" verdict with yellow emoji and label', async () => {
    const mockShare = Share.share as jest.Mock;
    mockShare.mockResolvedValue({ action: 'sharedAction' });

    const session: Session = {
      id: '1',
      timestamp: '2024-01-15T08:30:00Z',
      durationSeconds: 300,
      rrIntervals: [],
      rmssd: 45.2,
      sdnn: 60.1,
      meanHr: 70,
      pnn50: 15.5,
      artifactRate: 2.3,
      verdict: 'moderate',
      perceivedReadiness: null,
      trainingType: null,
      notes: '',
      sleepHours: null,
      sleepQuality: null,
      stressLevel: null,
      source: 'chest_strap',
    };

    await shareVerdict(session);

    const call = mockShare.mock.calls[0][0];
    expect(call.message).toContain('🟡 HRV Readiness');
    expect(call.message).toContain('Verdict: Moderate');
  });

  it('formats "rest" verdict with red emoji and label', async () => {
    const mockShare = Share.share as jest.Mock;
    mockShare.mockResolvedValue({ action: 'sharedAction' });

    const session: Session = {
      id: '1',
      timestamp: '2024-01-15T08:30:00Z',
      durationSeconds: 300,
      rrIntervals: [],
      rmssd: 45.2,
      sdnn: 60.1,
      meanHr: 70,
      pnn50: 15.5,
      artifactRate: 2.3,
      verdict: 'rest',
      perceivedReadiness: null,
      trainingType: null,
      notes: '',
      sleepHours: null,
      sleepQuality: null,
      stressLevel: null,
      source: 'chest_strap',
    };

    await shareVerdict(session);

    const call = mockShare.mock.calls[0][0];
    expect(call.message).toContain('🔴 HRV Readiness');
    expect(call.message).toContain('Verdict: Rest');
  });

  it('formats null verdict with white emoji and "Building Baseline" label', async () => {
    const mockShare = Share.share as jest.Mock;
    mockShare.mockResolvedValue({ action: 'sharedAction' });

    const session: Session = {
      id: '1',
      timestamp: '2024-01-15T08:30:00Z',
      durationSeconds: 300,
      rrIntervals: [],
      rmssd: 45.2,
      sdnn: 60.1,
      meanHr: 70,
      pnn50: 15.5,
      artifactRate: 2.3,
      verdict: null,
      perceivedReadiness: null,
      trainingType: null,
      notes: '',
      sleepHours: null,
      sleepQuality: null,
      stressLevel: null,
      source: 'chest_strap',
    };

    await shareVerdict(session);

    const call = mockShare.mock.calls[0][0];
    expect(call.message).toContain('⚪ HRV Readiness');
    expect(call.message).toContain('Verdict: Building Baseline');
  });

  it('includes basic metrics in message', async () => {
    const mockShare = Share.share as jest.Mock;
    mockShare.mockResolvedValue({ action: 'sharedAction' });

    const session: Session = {
      id: '1',
      timestamp: '2024-01-15T08:30:00Z',
      durationSeconds: 300,
      rrIntervals: [],
      rmssd: 45.2,
      sdnn: 60.1,
      meanHr: 70,
      pnn50: 15.5,
      artifactRate: 2.3,
      verdict: 'go_hard',
      perceivedReadiness: null,
      trainingType: null,
      notes: '',
      sleepHours: null,
      sleepQuality: null,
      stressLevel: null,
      source: 'chest_strap',
    };

    await shareVerdict(session);

    const call = mockShare.mock.calls[0][0];
    expect(call.message).toContain('rMSSD: 45.2 ms');
    expect(call.message).toContain('Mean HR: 70 bpm');
    expect(call.message).toContain('SDNN: 60.1 ms');
  });

  it('includes perceivedReadiness when present', async () => {
    const mockShare = Share.share as jest.Mock;
    mockShare.mockResolvedValue({ action: 'sharedAction' });

    const session: Session = {
      id: '1',
      timestamp: '2024-01-15T08:30:00Z',
      durationSeconds: 300,
      rrIntervals: [],
      rmssd: 45.2,
      sdnn: 60.1,
      meanHr: 70,
      pnn50: 15.5,
      artifactRate: 2.3,
      verdict: 'moderate',
      perceivedReadiness: 4,
      trainingType: null,
      notes: '',
      sleepHours: null,
      sleepQuality: null,
      stressLevel: null,
      source: 'chest_strap',
    };

    await shareVerdict(session);

    const call = mockShare.mock.calls[0][0];
    expect(call.message).toContain('Perceived readiness: 4/5');
  });

  it('excludes perceivedReadiness when not present', async () => {
    const mockShare = Share.share as jest.Mock;
    mockShare.mockResolvedValue({ action: 'sharedAction' });

    const session: Session = {
      id: '1',
      timestamp: '2024-01-15T08:30:00Z',
      durationSeconds: 300,
      rrIntervals: [],
      rmssd: 45.2,
      sdnn: 60.1,
      meanHr: 70,
      pnn50: 15.5,
      artifactRate: 2.3,
      verdict: 'rest',
      perceivedReadiness: null,
      trainingType: null,
      notes: '',
      sleepHours: null,
      sleepQuality: null,
      stressLevel: null,
      source: 'chest_strap',
    };

    await shareVerdict(session);

    const call = mockShare.mock.calls[0][0];
    expect(call.message).not.toContain('Perceived readiness');
  });

  it('includes trainingType when present', async () => {
    const mockShare = Share.share as jest.Mock;
    mockShare.mockResolvedValue({ action: 'sharedAction' });

    const session: Session = {
      id: '1',
      timestamp: '2024-01-15T08:30:00Z',
      durationSeconds: 300,
      rrIntervals: [],
      rmssd: 45.2,
      sdnn: 60.1,
      meanHr: 70,
      pnn50: 15.5,
      artifactRate: 2.3,
      verdict: 'go_hard',
      perceivedReadiness: null,
      trainingType: 'Strength',
      notes: '',
      sleepHours: null,
      sleepQuality: null,
      stressLevel: null,
      source: 'chest_strap',
    };

    await shareVerdict(session);

    const call = mockShare.mock.calls[0][0];
    expect(call.message).toContain('Training: Strength');
  });

  it('excludes trainingType when not present', async () => {
    const mockShare = Share.share as jest.Mock;
    mockShare.mockResolvedValue({ action: 'sharedAction' });

    const session: Session = {
      id: '1',
      timestamp: '2024-01-15T08:30:00Z',
      durationSeconds: 300,
      rrIntervals: [],
      rmssd: 45.2,
      sdnn: 60.1,
      meanHr: 70,
      pnn50: 15.5,
      artifactRate: 2.3,
      verdict: 'moderate',
      perceivedReadiness: null,
      trainingType: null,
      notes: '',
      sleepHours: null,
      sleepQuality: null,
      stressLevel: null,
      source: 'chest_strap',
    };

    await shareVerdict(session);

    const call = mockShare.mock.calls[0][0];
    expect(call.message).not.toContain('Training:');
  });

  it('includes both optional fields when present', async () => {
    const mockShare = Share.share as jest.Mock;
    mockShare.mockResolvedValue({ action: 'sharedAction' });

    const session: Session = {
      id: '1',
      timestamp: '2024-01-15T08:30:00Z',
      durationSeconds: 300,
      rrIntervals: [],
      rmssd: 45.2,
      sdnn: 60.1,
      meanHr: 70,
      pnn50: 15.5,
      artifactRate: 2.3,
      verdict: 'go_hard',
      perceivedReadiness: 5,
      trainingType: 'Cardio',
      notes: '',
      sleepHours: null,
      sleepQuality: null,
      stressLevel: null,
      source: 'chest_strap',
    };

    await shareVerdict(session);

    const call = mockShare.mock.calls[0][0];
    expect(call.message).toContain('Perceived readiness: 5/5');
    expect(call.message).toContain('Training: Cardio');
  });

  it('formats date correctly', async () => {
    const mockShare = Share.share as jest.Mock;
    mockShare.mockResolvedValue({ action: 'sharedAction' });

    const session: Session = {
      id: '1',
      timestamp: '2024-01-15T08:30:00Z',
      durationSeconds: 300,
      rrIntervals: [],
      rmssd: 45.2,
      sdnn: 60.1,
      meanHr: 70,
      pnn50: 15.5,
      artifactRate: 2.3,
      verdict: 'moderate',
      perceivedReadiness: null,
      trainingType: null,
      notes: '',
      sleepHours: null,
      sleepQuality: null,
      stressLevel: null,
      source: 'chest_strap',
    };

    await shareVerdict(session);

    const call = mockShare.mock.calls[0][0];
    // Date should be formatted like "Mon, Jan 15"
    expect(call.message).toMatch(/Mon, Jan 15/);
  });

  it('includes app attribution in message', async () => {
    const mockShare = Share.share as jest.Mock;
    mockShare.mockResolvedValue({ action: 'sharedAction' });

    const session: Session = {
      id: '1',
      timestamp: '2024-01-15T08:30:00Z',
      durationSeconds: 300,
      rrIntervals: [],
      rmssd: 45.2,
      sdnn: 60.1,
      meanHr: 70,
      pnn50: 15.5,
      artifactRate: 2.3,
      verdict: 'go_hard',
      perceivedReadiness: null,
      trainingType: null,
      notes: '',
      sleepHours: null,
      sleepQuality: null,
      stressLevel: null,
      source: 'chest_strap',
    };

    await shareVerdict(session);

    const call = mockShare.mock.calls[0][0];
    expect(call.message).toContain('HRV Readiness Dashboard');
  });
});
