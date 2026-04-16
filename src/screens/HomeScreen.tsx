import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { VerdictDisplay } from '../components/VerdictDisplay';
import { StatCard } from '../components/StatCard';
import { Sparkline } from '../components/Sparkline';
import { COLORS } from '../constants/colors';
import { STRINGS } from '../constants/strings';
import { Session } from '../types';
import {
  getTodaySession,
  getDailyReadings,
  getSessionDates,
  getRecentSessions,
} from '../database/sessionRepository';
import { loadSettings } from '../database/settingsRepository';
import { computeBaseline } from '../hrv/baseline';
import { computeRecoveryScore, RecoveryScore, computeWeeklyLoad } from '../hrv/recovery';
import { shareVerdict } from '../utils/profiles';
import { todayString } from '../utils/date';
import { calculateStreak } from '../utils/date';
import { ARTIFACT_WARNING_THRESHOLD } from '../constants/defaults';

type HomeNavProp = NativeStackNavigationProp<RootStackParamList>;

function RecoveryBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.recoveryBarContainer}>
      <Text style={styles.recoveryBarLabel}>{label}</Text>
      <View style={styles.recoveryBarTrack}>
        <View
          style={[
            styles.recoveryBarFill,
            {
              width: `${Math.min(value, 100)}%`,
              backgroundColor:
                value >= 70 ? COLORS.success : value >= 40 ? COLORS.warning : COLORS.danger,
            },
          ]}
        />
      </View>
      <Text style={styles.recoveryBarValue}>{value}</Text>
    </View>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const [todaySession, setTodaySession] = useState<Session | null>(null);
  const [sparklineData, setSparklineData] = useState<number[]>([]);
  const [baselineMedian, setBaselineMedian] = useState<number | undefined>(undefined);
  const [recoveryScore, setRecoveryScore] = useState<RecoveryScore | null>(null);
  const [weeklyLoad, setWeeklyLoad] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [session, settings, dates, recentSessions] = await Promise.all([
        getTodaySession(todayString()),
        loadSettings(),
        getSessionDates(),
        getRecentSessions(7),
      ]);

      setTodaySession(session);
      setStreak(calculateStreak(dates));

      const dailyRmssd = recentSessions.map((s) => s.rmssd);
      setSparklineData(dailyRmssd);

      const dailyReadings = await getDailyReadings(settings.baselineWindowDays);
      const baseline = computeBaseline(dailyReadings, settings.baselineWindowDays);
      if (baseline.dayCount > 0) {
        setBaselineMedian(baseline.median);
      }

      if (session && baseline.dayCount >= 5) {
        setRecoveryScore(computeRecoveryScore(session, baseline));
      }
      setWeeklyLoad(computeWeeklyLoad(recentSessions));
    } catch (error) {
      console.error('Failed to load home data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    []
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: COLORS.background,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  const hasReading = todaySession !== null;
  const artifactWarning = todaySession && todaySession.artifactRate > ARTIFACT_WARNING_THRESHOLD;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.date}>{today}</Text>
        {streak > 0 && <Text style={styles.streak}>{STRINGS.dayStreak(streak)}</Text>}
      </View>

      {/* Verdict */}
      {hasReading ? (
        <VerdictDisplay
          verdict={todaySession.verdict}
          rmssd={todaySession.rmssd}
          size="large"
          baselineValue={baselineMedian}
          percentOfBaseline={baselineMedian ? todaySession.rmssd / baselineMedian : undefined}
        />
      ) : (
        <View style={styles.noReading}>
          <Text style={styles.noReadingEmoji}>💤</Text>
          <Text style={styles.noReadingText}>{STRINGS.noReadingYet}</Text>
          <Text style={styles.noReadingHint}>
            Put on your HR monitor and take a 5-minute reading to see your readiness verdict.
          </Text>
        </View>
      )}

      {/* Recovery Score */}
      {recoveryScore && (
        <View style={styles.recoveryContainer}>
          <Text style={styles.sectionLabel}>{STRINGS.recoveryScore}</Text>
          <View style={styles.recoveryRow}>
            <View style={styles.recoveryScoreCircle}>
              <Text style={styles.recoveryScoreValue}>{recoveryScore.score}</Text>
              <Text style={styles.recoveryScoreLabel}>{recoveryScore.label}</Text>
            </View>
            <View style={styles.recoveryComponents}>
              <RecoveryBar label="HRV" value={recoveryScore.components.hrv} />
              <RecoveryBar label="Sleep" value={recoveryScore.components.sleep} />
              <RecoveryBar label="Stress" value={recoveryScore.components.stress} />
              <RecoveryBar label="Readiness" value={recoveryScore.components.readiness} />
            </View>
          </View>
          {weeklyLoad > 0 && (
            <Text style={styles.weeklyLoadText}>📊 Weekly training load: {weeklyLoad}</Text>
          )}
        </View>
      )}

      {/* Sparkline */}
      {sparklineData.length >= 2 && (
        <View style={styles.sparklineContainer}>
          <Text style={styles.sectionLabel}>{STRINGS.rmssdLast7Days}</Text>
          <Sparkline
            data={sparklineData}
            width={320}
            height={80}
            showBaseline={baselineMedian !== undefined}
            baselineValue={baselineMedian}
          />
        </View>
      )}

      {/* Stats */}
      {hasReading && (
        <View style={styles.statsRow}>
          <StatCard
            label={STRINGS.meanHr}
            value={todaySession.meanHr.toFixed(0)}
            unit={STRINGS.bpm}
          />
          <StatCard label={STRINGS.sdnn} value={todaySession.sdnn.toFixed(1)} unit={STRINGS.ms} />
          <StatCard
            label={STRINGS.artifacts}
            value={`${(todaySession.artifactRate * 100).toFixed(1)}%`}
            warning={artifactWarning ?? false}
          />
        </View>
      )}

      {hasReading && (
        <View style={styles.statsRow}>
          <StatCard
            label={STRINGS.pnn50}
            value={todaySession.pnn50.toFixed(1)}
            unit={STRINGS.percent}
          />
          <StatCard
            label={STRINGS.duration}
            value={`${Math.floor(todaySession.durationSeconds / 60)}m ${todaySession.durationSeconds % 60}s`}
          />
        </View>
      )}

      {/* Start Reading Button */}
      {!hasReading && (
        <View style={{ gap: 12, marginTop: 32 }}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => navigation.navigate('Reading')}
            accessibilityRole="button"
            accessibilityLabel="Start morning reading"
            activeOpacity={0.7}
          >
            <Text style={styles.startButtonText}>Start Reading</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.startButton,
              { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
            ]}
            onPress={() => navigation.navigate('Orthostatic')}
            accessibilityRole="button"
            accessibilityLabel="Start orthostatic test"
            activeOpacity={0.7}
          >
            <Text style={[styles.startButtonText, { color: COLORS.accent }]}>
              🧍 Orthostatic Test
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.startButton,
              { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
            ]}
            onPress={() => navigation.navigate('CameraReading')}
            accessibilityRole="button"
            accessibilityLabel="Camera-based reading without chest strap"
            activeOpacity={0.7}
          >
            <Text style={[styles.startButtonText, { color: COLORS.accent }]}>
              📸 Camera Reading (No Strap)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Share Verdict */}
      {hasReading && (
        <TouchableOpacity
          style={[
            styles.startButton,
            {
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.border,
              marginTop: 20,
            },
          ]}
          onPress={() => shareVerdict(todaySession)}
          accessibilityRole="button"
          accessibilityLabel="Share today's verdict"
          activeOpacity={0.7}
        >
          <Text style={[styles.startButtonText, { color: COLORS.accent, fontSize: 16 }]}>
            📤 Share Verdict
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  date: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  streak: {
    fontSize: 14,
    color: COLORS.warning,
    fontWeight: '600',
  },
  noReading: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noReadingEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  noReadingText: {
    fontSize: 18,
    color: COLORS.textSecondary,
  },
  noReadingHint: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  sparklineContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  startButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 32,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  recoveryContainer: {
    marginTop: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  recoveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  recoveryScoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recoveryScoreValue: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
  },
  recoveryScoreLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  recoveryComponents: {
    flex: 1,
    gap: 6,
  },
  recoveryBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recoveryBarLabel: {
    width: 60,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  recoveryBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.surfaceLight,
  },
  recoveryBarFill: {
    height: 6,
    borderRadius: 3,
  },
  recoveryBarValue: {
    width: 24,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  weeklyLoadText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 12,
    textAlign: 'center',
  },
});
