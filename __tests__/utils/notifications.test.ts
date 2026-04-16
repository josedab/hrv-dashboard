jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
}));
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));
jest.mock('../../src/database/database', () => ({
  getDatabase: jest.fn(),
}));

import * as Notifications from 'expo-notifications';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationSettings,
  scheduleMorningReminder,
  scheduleStreakReminder,
  cancelAllReminders,
  loadNotificationSettings,
  saveNotificationSettings,
  requestNotificationPermissions,
} from '../../src/utils/notifications';
import { getDatabase } from '../../src/database/database';

// Mock types
interface MockNotifications {
  scheduleNotificationAsync: jest.Mock;
  cancelScheduledNotificationAsync: jest.Mock;
  setNotificationHandler: jest.Mock;
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  SchedulableTriggerInputTypes: { DAILY: string };
}

describe('scheduleMorningReminder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clamps hour to valid range (0-23)', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('id');
    mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

    await scheduleMorningReminder(-5, 30);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ hour: 0, minute: 30 }),
      })
    );
  });

  it('clamps hour to 23 when exceeding upper bound', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('id');
    mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

    await scheduleMorningReminder(25, 30);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ hour: 23, minute: 30 }),
      })
    );
  });

  it('clamps minute to valid range (0-59)', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('id');
    mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

    await scheduleMorningReminder(6, -10);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ hour: 6, minute: 0 }),
      })
    );
  });

  it('clamps minute to 59 when exceeding upper bound', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('id');
    mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

    await scheduleMorningReminder(6, 75);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ hour: 6, minute: 59 }),
      })
    );
  });

  it('floors fractional hour and minute values', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('id');
    mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

    await scheduleMorningReminder(6.7, 30.9);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ hour: 6, minute: 30 }),
      })
    );
  });

  it('cancels existing reminder before scheduling new one', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('id');
    mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

    await scheduleMorningReminder(6, 30);

    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'morning-reminder'
    );
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('uses correct notification content', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('id');
    mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

    await scheduleMorningReminder(6, 30);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'morning-reminder',
        content: expect.objectContaining({
          title: '❤️ Time for your HRV reading',
          body: 'Take 5 minutes to check your morning readiness.',
          sound: false,
        }),
      })
    );
  });
});

describe('scheduleStreakReminder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips scheduling when streak < 2', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('id');
    mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

    await scheduleStreakReminder(0);

    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();

    jest.clearAllMocks();
    await scheduleStreakReminder(1);

    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules when streak is exactly 2', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('id');
    mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

    await scheduleStreakReminder(2);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('schedules when streak is > 2', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('id');
    mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

    await scheduleStreakReminder(10);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('includes streak count in notification title', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('id');
    mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

    await scheduleStreakReminder(5);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: `🔥 Don't break your 5-day streak!`,
        }),
      })
    );
  });

  it('schedules at 10 AM', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('id');
    mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

    await scheduleStreakReminder(3);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ hour: 10, minute: 0 }),
      })
    );
  });

  it('cancels existing reminder before scheduling', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('id');
    mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

    await scheduleStreakReminder(5);

    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'streak-reminder'
    );
  });
});

describe('cancelAllReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cancels both morning and streak reminders', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

    await cancelAllReminders();

    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'morning-reminder'
    );
    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'streak-reminder'
    );
  });

  it('does not throw when cancellation fails', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.cancelScheduledNotificationAsync.mockRejectedValue(
      new Error('Cancel failed')
    );

    await expect(cancelAllReminders()).resolves.not.toThrow();
  });
});

describe('loadNotificationSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns defaults when no settings exist', async () => {
    const mockDb = {
      getAllAsync: jest.fn().mockResolvedValue([]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const settings = await loadNotificationSettings();

    expect(settings).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
  });

  it('loads all notification settings from database', async () => {
    const mockDb = {
      getAllAsync: jest.fn().mockResolvedValue([
        { key: 'notification_morning_enabled', value: 'true' },
        { key: 'notification_morning_hour', value: '7' },
        { key: 'notification_morning_minute', value: '45' },
        { key: 'notification_streak_enabled', value: 'true' },
      ]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const settings = await loadNotificationSettings();

    expect(settings).toEqual({
      morningReminderEnabled: true,
      morningReminderHour: 7,
      morningReminderMinute: 45,
      streakReminderEnabled: true,
    });
  });

  it('uses defaults for missing values', async () => {
    const mockDb = {
      getAllAsync: jest
        .fn()
        .mockResolvedValue([{ key: 'notification_morning_enabled', value: 'false' }]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const settings = await loadNotificationSettings();

    expect(settings.morningReminderEnabled).toBe(false);
    expect(settings.morningReminderHour).toBe(DEFAULT_NOTIFICATION_SETTINGS.morningReminderHour);
    expect(settings.morningReminderMinute).toBe(
      DEFAULT_NOTIFICATION_SETTINGS.morningReminderMinute
    );
    expect(settings.streakReminderEnabled).toBe(true);
  });

  it('treats missing streak_enabled as true (enabled by default)', async () => {
    const mockDb = {
      getAllAsync: jest
        .fn()
        .mockResolvedValue([{ key: 'notification_morning_enabled', value: 'true' }]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const settings = await loadNotificationSettings();

    expect(settings.streakReminderEnabled).toBe(true);
  });

  it('treats streak_enabled=false correctly', async () => {
    const mockDb = {
      getAllAsync: jest
        .fn()
        .mockResolvedValue([{ key: 'notification_streak_enabled', value: 'false' }]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const settings = await loadNotificationSettings();

    expect(settings.streakReminderEnabled).toBe(false);
  });
});

describe('saveNotificationSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves all notification settings to database', async () => {
    const mockDb = {
      runAsync: jest.fn().mockResolvedValue(undefined),
      withTransactionAsync: jest.fn(async (fn) => fn()),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const Notif = Notifications as unknown as MockNotifications;
    Notif.scheduleNotificationAsync.mockResolvedValue('id');
    Notif.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

    const settings: NotificationSettings = {
      morningReminderEnabled: true,
      morningReminderHour: 7,
      morningReminderMinute: 45,
      streakReminderEnabled: false,
    };

    await saveNotificationSettings(settings);

    expect(mockDb.withTransactionAsync).toHaveBeenCalled();
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      'notification_morning_enabled',
      'true'
    );
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      'notification_morning_hour',
      '7'
    );
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      'notification_morning_minute',
      '45'
    );
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      'notification_streak_enabled',
      'false'
    );
  });

  it('schedules morning reminder when enabled', async () => {
    const mockDb = {
      runAsync: jest.fn().mockResolvedValue(undefined),
      withTransactionAsync: jest.fn(async (fn) => fn()),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const Notif = Notifications as unknown as MockNotifications;
    Notif.scheduleNotificationAsync.mockResolvedValue('id');
    Notif.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

    const settings: NotificationSettings = {
      morningReminderEnabled: true,
      morningReminderHour: 6,
      morningReminderMinute: 30,
      streakReminderEnabled: true,
    };

    await saveNotificationSettings(settings);

    expect(Notif.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('cancels morning reminder when disabled', async () => {
    const mockDb = {
      runAsync: jest.fn().mockResolvedValue(undefined),
      withTransactionAsync: jest.fn(async (fn) => fn()),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);

    const Notif = Notifications as unknown as MockNotifications;
    Notif.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

    const settings: NotificationSettings = {
      morningReminderEnabled: false,
      morningReminderHour: 6,
      morningReminderMinute: 30,
      streakReminderEnabled: true,
    };

    await saveNotificationSettings(settings);

    expect(Notif.cancelScheduledNotificationAsync).toHaveBeenCalledWith('morning-reminder');
  });
});

describe('requestNotificationPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when permissions already granted', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });

    const result = await requestNotificationPermissions();

    expect(result).toBe(true);
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requests permissions when not previously granted', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });

    const result = await requestNotificationPermissions();

    expect(result).toBe(true);
    expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it('returns false when permission request is denied', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const result = await requestNotificationPermissions();

    expect(result).toBe(false);
  });

  it('returns false when permissions are denied', async () => {
    const mockNotifications = Notifications as unknown as MockNotifications;
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const result = await requestNotificationPermissions();

    expect(result).toBe(false);
  });
});
