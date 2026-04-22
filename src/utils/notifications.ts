/**
 * Scheduled notification management (morning reminder, streak, weekly digest).
 *
 * Uses expo-notifications to schedule local notifications at user-configured
 * times. Morning reminder time can be inferred from session timestamps.
 * Settings are persisted in the SQLite settings table.
 */
import * as Notifications from 'expo-notifications';
import { getDatabase } from '../database/database';

const MORNING_REMINDER_ID = 'morning-reminder';
const STREAK_REMINDER_ID = 'streak-reminder';
const WEEKLY_DIGEST_ID = 'weekly-digest';

/** Cancel a scheduled notification by ID. Swallows errors because the notification may not exist. */
async function cancelSafe(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Notification may not exist yet — expected during first schedule
  }
}

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
export async function scheduleMorningReminder(hour: number, minute: number): Promise<void> {
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  const m = Math.max(0, Math.min(59, Math.floor(minute)));

  await cancelSafe(MORNING_REMINDER_ID);

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
  await cancelSafe(STREAK_REMINDER_ID);

  if (currentStreak < 2) return;

  await Notifications.scheduleNotificationAsync({
    identifier: STREAK_REMINDER_ID,
    content: {
      title: `🔥 Don't break your ${currentStreak}-day streak!`,
      body: "You haven't taken a reading yet today.",
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
  await cancelSafe(MORNING_REMINDER_ID);
  await cancelSafe(STREAK_REMINDER_ID);
}

/** Range-clamping integer parser shared with settingsRepository style. */
function parseClampedInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (raw === undefined || raw === '') return fallback;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min || parsed > max) {
    console.warn(
      `[notifications] Stored value '${raw}' outside ${min}–${max}; using default ${fallback}`
    );
    return fallback;
  }
  return parsed;
}

/**
 * Loads notification settings from the database.
 *
 * Validates each value through {@link parseClampedInt} so a corrupted DB
 * row (e.g. an out-of-range hour) cannot crash the scheduler.
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
    morningReminderHour: parseClampedInt(
      stored.notification_morning_hour,
      DEFAULT_NOTIFICATION_SETTINGS.morningReminderHour,
      0,
      23
    ),
    morningReminderMinute: parseClampedInt(
      stored.notification_morning_minute,
      DEFAULT_NOTIFICATION_SETTINGS.morningReminderMinute,
      0,
      59
    ),
    streakReminderEnabled: stored.notification_streak_enabled !== 'false',
  };
}

/**
 * Saves notification settings and reschedules notifications.
 *
 * Values are clamped to their valid domain before persisting so a UI bug
 * cannot poison the stored config.
 */
export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  const db = await getDatabase();
  const hour = Math.max(0, Math.min(23, Math.floor(settings.morningReminderHour)));
  const minute = Math.max(0, Math.min(59, Math.floor(settings.morningReminderMinute)));
  const entries = [
    ['notification_morning_enabled', String(!!settings.morningReminderEnabled)],
    ['notification_morning_hour', String(hour)],
    ['notification_morning_minute', String(minute)],
    ['notification_streak_enabled', String(!!settings.streakReminderEnabled)],
  ];

  await db.withTransactionAsync(async () => {
    for (const [key, value] of entries) {
      await db.runAsync(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, key, value);
    }
  });

  if (settings.morningReminderEnabled) {
    await scheduleMorningReminder(hour, minute);
  } else {
    await cancelSafe(MORNING_REMINDER_ID);
  }
}

/**
 * Infers the user's typical recording time from recent session timestamps.
 * Returns { hour, minute } from the median of session local times,
 * or the default if fewer than 3 sessions.
 */
export function inferRecordingTime(
  sessionTimestamps: string[],
  fallback: { hour: number; minute: number } = {
    hour: DEFAULT_NOTIFICATION_SETTINGS.morningReminderHour,
    minute: DEFAULT_NOTIFICATION_SETTINGS.morningReminderMinute,
  }
): { hour: number; minute: number } {
  if (sessionTimestamps.length < 3) return fallback;

  const minutesOfDay = sessionTimestamps.map((ts) => {
    const d = new Date(ts);
    return d.getHours() * 60 + d.getMinutes();
  });

  minutesOfDay.sort((a, b) => a - b);
  const medianMinutes = minutesOfDay[Math.floor(minutesOfDay.length / 2)];

  // Schedule 5 minutes before typical time
  const adjusted = Math.max(0, medianMinutes - 5);
  return {
    hour: Math.floor(adjusted / 60),
    minute: adjusted % 60,
  };
}

/**
 * Schedules a weekly digest notification (Sunday 7 PM).
 * Shows trend direction and streak count.
 */
export async function scheduleWeeklyDigest(
  trendDirection: 'improving' | 'stable' | 'declining',
  streak: number
): Promise<void> {
  await cancelSafe(WEEKLY_DIGEST_ID);

  const trendEmoji =
    trendDirection === 'improving' ? '📈' : trendDirection === 'declining' ? '📉' : '➡️';
  const trendText =
    trendDirection === 'improving'
      ? 'Your HRV is trending up this week!'
      : trendDirection === 'declining'
        ? 'Your HRV dipped this week — prioritize recovery.'
        : 'Your HRV is steady this week.';

  const streakText = streak >= 3 ? ` 🔥 ${streak}-day streak!` : '';

  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_DIGEST_ID,
    content: {
      title: `${trendEmoji} Weekly HRV Summary`,
      body: `${trendText}${streakText}`,
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // Sunday
      hour: 19,
      minute: 0,
    },
  });
}
