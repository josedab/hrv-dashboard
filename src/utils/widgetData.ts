/**
 * Home screen widget data provider (iOS WidgetKit / Android Glance).
 *
 * Assembles the data payload that native widgets display: today's verdict,
 * rMSSD, baseline comparison, streak count, and a 7-day sparkline array.
 * Data is persisted to the settings table for the native bridge to read.
 */
import { getDatabase } from '../database/database';
import { getTodaySession, getDailyReadings } from '../database/sessionRepository';
import { loadSettings } from '../database/settingsRepository';
import { computeBaseline } from '../hrv/baseline';
import { todayString, calculateStreak } from './date';

/**
 * Data structure for the home screen widget.
 * Provides all information needed for iOS WidgetKit / Android Glance widgets.
 */
export interface WidgetData {
  /** Whether a reading has been taken today. */
  hasReading: boolean;
  /** Today's verdict. */
  verdict: string | null;
  /** Today's rMSSD. */
  rmssd: number | null;
  /** Baseline median. */
  baselineMedian: number | null;
  /** Percentage of baseline (0–100+). */
  percentOfBaseline: number | null;
  /** Current streak in days. */
  streak: number;
  /** Last 7 rMSSD values for sparkline. */
  sparklineValues: number[];
  /** Formatted date string. */
  dateLabel: string;
  /** Last updated timestamp. */
  updatedAt: string;
}

/**
 * Gathers all data needed for the widget display.
 * Called after each recording and on app launch to update widget data.
 */
export async function getWidgetData(): Promise<WidgetData> {
  try {
    const today = todayString();
    const settings = await loadSettings();
    const session = await getTodaySession(today);
    const dailyReadings = await getDailyReadings(settings.baselineWindowDays);
    const baseline = computeBaseline(dailyReadings, settings.baselineWindowDays);

    // Get session dates for streak
    const db = await getDatabase();
    const dateRows = await db.getAllAsync<{ date_str: string }>(
      `SELECT DISTINCT date(timestamp, 'localtime') as date_str FROM sessions ORDER BY date_str DESC`
    );
    const dates = dateRows.map((r) => r.date_str);

    // Calculate streak
    const streak = calculateStreak(dates);

    // Get recent rMSSD values for sparkline
    const recentRows = await db.getAllAsync<{ rmssd: number }>(
      `SELECT rmssd FROM sessions ORDER BY timestamp DESC LIMIT 7`
    );
    const sparklineValues = recentRows.map((r) => r.rmssd).reverse();

    const dateLabel = new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    return {
      hasReading: session !== null,
      verdict: session?.verdict ?? null,
      rmssd: session?.rmssd ?? null,
      baselineMedian: baseline.dayCount >= 5 ? baseline.median : null,
      percentOfBaseline:
        session && baseline.median > 0 && baseline.dayCount >= 5
          ? Math.round((session.rmssd / baseline.median) * 100)
          : null,
      streak,
      sparklineValues,
      dateLabel,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[WidgetData] Failed to gather widget data:', error);
    return {
      hasReading: false,
      verdict: null,
      rmssd: null,
      baselineMedian: null,
      percentOfBaseline: null,
      streak: 0,
      sparklineValues: [],
      dateLabel: '',
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Persists widget data to shared storage for native widget access.
 *
 * iOS: UserDefaults with app group
 * Android: SharedPreferences
 *
 * The native widget reads from this shared storage to display data
 * without launching the full React Native app.
 */
export async function updateNativeWidget(data: WidgetData): Promise<void> {
  // Serialize to JSON for native consumption
  const jsonData = JSON.stringify(data);

  // Store in settings table for native widget consumption.
  // When native WidgetKit (iOS) or Glance (Android) widgets are built,
  // also write to UserDefaults/SharedPreferences via native bridge.
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
    'widget_data',
    jsonData
  );
}

/**
 * Call after each session save to keep the widget current.
 */
export async function refreshWidget(): Promise<void> {
  const data = await getWidgetData();
  await updateNativeWidget(data);
}
