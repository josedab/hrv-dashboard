/** Data hook for the Home screen — loads today's session, baseline, verdict, recovery, and sparkline. */
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Session } from '../../types';
import {
  getTodaySession,
  getDailyReadings,
  getSessionDates,
  getRecentSessions,
} from '../../database/sessionRepository';
import { loadSettings } from '../../database/settingsRepository';
import { computeBaseline } from '../../hrv/baseline';
import { computeRecoveryScore, RecoveryScore, computeWeeklyLoad } from '../../hrv/recovery';
import { calculateStreak, todayString } from '../../utils/date';

export interface HomeData {
  todaySession: Session | null;
  sparklineData: number[];
  baselineMedian?: number;
  recoveryScore: RecoveryScore | null;
  weeklyLoad: number;
  streak: number;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

/**
 * Loads everything the Home screen needs in one place. Re-runs whenever the
 * Home tab regains focus so a fresh reading shows up without manual reload.
 */
export function useHomeData(): HomeData {
  const [todaySession, setTodaySession] = useState<Session | null>(null);
  const [sparklineData, setSparklineData] = useState<number[]>([]);
  const [baselineMedian, setBaselineMedian] = useState<number | undefined>(undefined);
  const [recoveryScore, setRecoveryScore] = useState<RecoveryScore | null>(null);
  const [weeklyLoad, setWeeklyLoad] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [session, settings, dates, recentSessions] = await Promise.all([
        getTodaySession(todayString()),
        loadSettings(),
        getSessionDates(),
        getRecentSessions(7),
      ]);

      setTodaySession(session);
      setStreak(calculateStreak(dates));
      setSparklineData(recentSessions.map((s) => s.rmssd));

      const dailyReadings = await getDailyReadings(settings.baselineWindowDays);
      const baseline = computeBaseline(dailyReadings, settings.baselineWindowDays);
      setBaselineMedian(baseline.dayCount > 0 ? baseline.median : undefined);

      setRecoveryScore(
        session && baseline.dayCount >= 5 ? computeRecoveryScore(session, baseline) : null
      );
      setWeeklyLoad(computeWeeklyLoad(recentSessions));
    } catch (error) {
      console.error('Failed to load home data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return {
    todaySession,
    sparklineData,
    baselineMedian,
    recoveryScore,
    weeklyLoad,
    streak,
    loading,
    refreshing,
    refresh,
  };
}
