import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getDatabase } from '../database/database';

const MORNING_REMINDER_ID = 'morning-reminder';
const STREAK_REMINDER_ID = 'streak-reminder';

export interface NotificationSettings {
  morningReminderEnabled: boolean;
  /** Hour of day (0–23) for the morning reminder. */
  morningReminderHour: number;
  /** Minute of hour (0–59) for the morning reminder. */
  morningReminderMinute: number;
  streakReminderEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  morningReminderEnabled: false,
  morningReminderHour: 6,
  morningReminderMinute: 30,
  streakReminderEnabled: true,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests notification permissions. Returns true if granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Schedules the daily morning reminder notification.
 * @param hour 0-23
 * @param minute 0-59
 */
export async function scheduleMorningReminder(
  hour: number,
  minute: number
): Promise<void> {
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  const m = Math.max(0, Math.min(59, Math.floor(minute)));

  await Notifications.cancelScheduledNotificationAsync(MORNING_REMINDER_ID).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: MORNING_REMINDER_ID,
    content: {
      title: '❤️ Time for your HRV reading',
      body: 'Take 5 minutes to check your morning readiness.',
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: h,
      minute: m,
    },
  });
}

/**
 * Schedules a streak-protection reminder at 10 AM if no reading today.
 */
export async function scheduleStreakReminder(currentStreak: number): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(STREAK_REMINDER_ID).catch(() => {});

  if (currentStreak < 2) return;

  await Notifications.scheduleNotificationAsync({
    identifier: STREAK_REMINDER_ID,
    content: {
      title: `🔥 Don't break your ${currentStreak}-day streak!`,
      body: 'You haven\'t taken a reading yet today.',
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 10,
      minute: 0,
    },
  });
}

/**
 * Cancels all scheduled HRV notifications.
 */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(MORNING_REMINDER_ID).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(STREAK_REMINDER_ID).catch(() => {});
}

/**
 * Loads notification settings from the database.
 */
export async function loadNotificationSettings(): Promise<NotificationSettings> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key LIKE 'notification_%'`
  );

  const stored: Record<string, string> = {};
  for (const row of rows) {
    stored[row.key] = row.value;
  }

  return {
    morningReminderEnabled: stored.notification_morning_enabled === 'true',
    morningReminderHour: stored.notification_morning_hour
      ? parseInt(stored.notification_morning_hour, 10)
      : DEFAULT_NOTIFICATION_SETTINGS.morningReminderHour,
    morningReminderMinute: stored.notification_morning_minute
      ? parseInt(stored.notification_morning_minute, 10)
      : DEFAULT_NOTIFICATION_SETTINGS.morningReminderMinute,
    streakReminderEnabled: stored.notification_streak_enabled !== 'false',
  };
}

/**
 * Saves notification settings and reschedules notifications.
 */
export async function saveNotificationSettings(
  settings: NotificationSettings
): Promise<void> {
  const db = await getDatabase();
  const entries = [
    ['notification_morning_enabled', String(settings.morningReminderEnabled)],
    ['notification_morning_hour', String(settings.morningReminderHour)],
    ['notification_morning_minute', String(settings.morningReminderMinute)],
    ['notification_streak_enabled', String(settings.streakReminderEnabled)],
  ];

  await db.withTransactionAsync(async () => {
    for (const [key, value] of entries) {
      await db.runAsync(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
        key,
        value
      );
    }
  });

  if (settings.morningReminderEnabled) {
    await scheduleMorningReminder(settings.morningReminderHour, settings.morningReminderMinute);
  } else {
    await Notifications.cancelScheduledNotificationAsync(MORNING_REMINDER_ID).catch(() => {});
  }
}
