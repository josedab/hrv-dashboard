import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { VerdictDisplay } from '../components/VerdictDisplay';
import { StatCard } from '../components/StatCard';
import { Sparkline } from '../components/Sparkline';
import { COLORS } from '../constants/colors';
import { Session } from '../types';
import { getTodaySession, getDailyReadings, getSessionDates, getRecentSessions } from '../database/sessionRepository';
import { loadSettings } from '../database/settingsRepository';
import { computeBaseline } from '../hrv/baseline';
import { todayString } from '../utils/date';
import { calculateStreak } from '../utils/date';
import { ARTIFACT_WARNING_THRESHOLD } from '../constants/defaults';

type HomeNavProp = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const [todaySession, setTodaySession] = useState<Session | null>(null);
  const [sparklineData, setSparklineData] = useState<number[]>([]);
  const [baselineMedian, setBaselineMedian] = useState<number | undefined>(undefined);
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

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.date}>{today}</Text>
        {streak > 0 && (
          <Text style={styles.streak}>🔥 {streak} day streak</Text>
        )}
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
          <Text style={styles.noReadingText}>No reading yet today</Text>
        </View>
      )}

      {/* Sparkline */}
      {sparklineData.length >= 2 && (
        <View style={styles.sparklineContainer}>
          <Text style={styles.sectionLabel}>rMSSD — Last 7 Days</Text>
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
          <StatCard label="Mean HR" value={todaySession.meanHr.toFixed(0)} unit="bpm" />
          <StatCard label="SDNN" value={todaySession.sdnn.toFixed(1)} unit="ms" />
          <StatCard
            label="Artifacts"
            value={`${(todaySession.artifactRate * 100).toFixed(1)}%`}
            warning={artifactWarning ?? false}
          />
        </View>
      )}

      {hasReading && (
        <View style={styles.statsRow}>
          <StatCard label="pNN50" value={todaySession.pnn50.toFixed(1)} unit="%" />
          <StatCard label="Duration" value={`${Math.floor(todaySession.durationSeconds / 60)}m ${todaySession.durationSeconds % 60}s`} />
        </View>
      )}

      {/* Start Reading Button */}
      {!hasReading && (
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => navigation.navigate('Reading')}
          accessibilityRole="button"
          accessibilityLabel="Start morning reading"
        >
          <Text style={styles.startButtonText}>Start Reading</Text>
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
});
