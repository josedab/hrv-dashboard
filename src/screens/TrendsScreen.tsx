/** Trends screen — weekly analytics, correlations, verdict distribution, and sparkline trends. */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { COLORS } from '../constants/colors';
import { VERDICT_COLORS } from '../constants/colors';
import { STRINGS } from '../constants/strings';
import { Sparkline } from '../components/Sparkline';
import { StatCard } from '../components/StatCard';
import { getRecentSessions } from '../database/sessionRepository';
import {
  computeWeeklySummary,
  computeSleepHrvCorrelation,
  computeStressHrvCorrelation,
  WeeklySummary,
  CorrelationResult,
} from '../hrv/analytics';

export function TrendsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [sparklineData, setSparklineData] = useState<number[]>([]);
  const [sleepCorrelation, setSleepCorrelation] = useState<CorrelationResult | null>(null);
  const [stressCorrelation, setStressCorrelation] = useState<CorrelationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const [currentSessions, previousSessions, allRecent] = await Promise.all([
            getRecentSessions(7),
            getRecentSessions(14),
            getRecentSessions(30),
          ]);

          const previous = previousSessions.filter(
            (s) => !currentSessions.some((c) => c.id === s.id)
          );

          const weeklySummary = computeWeeklySummary(currentSessions, previous);
          setSummary(weeklySummary);
          setSparklineData(allRecent.map((s) => s.rmssd));
          setSleepCorrelation(computeSleepHrvCorrelation(allRecent));
          setStressCorrelation(computeStressHrvCorrelation(allRecent));
        } catch (error) {
          console.error('Failed to load trends:', error);
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (!summary || summary.sessionCount === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>📈</Text>
        <Text style={styles.emptyText}>{STRINGS.notEnoughData}</Text>
        <Text style={styles.emptyHint}>{STRINGS.notEnoughDataHint}</Text>
        <TouchableOpacity
          style={styles.emptyCta}
          onPress={() => navigation.navigate('Reading')}
          accessibilityRole="button"
          accessibilityLabel={STRINGS.takeReading}
          activeOpacity={0.8}
        >
          <Text style={styles.emptyCtaText}>❤️ {STRINGS.takeReading}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const trendIcon =
    summary.trendDirection === 'improving'
      ? '📈'
      : summary.trendDirection === 'declining'
        ? '📉'
        : '➡️';
  const trendColor =
    summary.trendDirection === 'improving'
      ? COLORS.success
      : summary.trendDirection === 'declining'
        ? COLORS.danger
        : COLORS.textSecondary;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      <Text style={styles.title}>{STRINGS.trends}</Text>

      {/* Trend Direction */}
      <View style={styles.trendBanner}>
        <Text style={styles.trendIcon}>{trendIcon}</Text>
        <View>
          <Text style={[styles.trendLabel, { color: trendColor }]}>
            {STRINGS.hrvIs(summary.trendDirection)}
          </Text>
          {summary.trendPercent !== 0 && (
            <Text style={styles.trendPercent}>
              {summary.trendPercent > 0 ? '+' : ''}
              {summary.trendPercent.toFixed(1)}% vs. previous week
            </Text>
          )}
        </View>
      </View>

      {/* Sparkline */}
      {sparklineData.length >= 2 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{STRINGS.rmssdLast30Days}</Text>
          <View style={styles.sparklineWrapper}>
            <Sparkline data={sparklineData} width={320} height={100} />
          </View>
        </View>
      )}

      {/* Weekly Stats */}
      <Text style={styles.sectionLabel}>{STRINGS.thisWeek}</Text>
      <View style={styles.statsRow}>
        <StatCard label="Avg rMSSD" value={summary.avgRmssd.toFixed(1)} unit="ms" />
        <StatCard label="Median rMSSD" value={summary.medianRmssd.toFixed(1)} unit="ms" />
      </View>
      <View style={styles.statsRow}>
        <StatCard label="Avg HR" value={summary.avgHr.toFixed(0)} unit="bpm" />
        <StatCard label="Sessions" value={String(summary.sessionCount)} />
      </View>

      {/* Best/Worst */}
      {summary.bestDay && summary.worstDay && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{STRINGS.highlights}</Text>
          <View style={styles.highlightRow}>
            <View style={styles.highlightCard}>
              <Text style={styles.highlightEmoji}>🏆</Text>
              <Text style={styles.highlightValue}>{summary.bestDay.rmssd.toFixed(1)} ms</Text>
              <Text style={styles.highlightLabel}>Best ({summary.bestDay.date.slice(5)})</Text>
            </View>
            <View style={styles.highlightCard}>
              <Text style={styles.highlightEmoji}>⬇️</Text>
              <Text style={styles.highlightValue}>{summary.worstDay.rmssd.toFixed(1)} ms</Text>
              <Text style={styles.highlightLabel}>Lowest ({summary.worstDay.date.slice(5)})</Text>
            </View>
          </View>
        </View>
      )}

      {/* Verdict Distribution */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{STRINGS.verdictBreakdown}</Text>
        <View style={styles.verdictRow}>
          {(['go_hard', 'moderate', 'rest'] as const).map((v) => (
            <View key={v} style={styles.verdictItem}>
              <Text style={[styles.verdictCount, { color: VERDICT_COLORS[v] }]}>
                {summary.verdictCounts[v]}
              </Text>
              <Text style={styles.verdictLabel}>
                {v === 'go_hard' ? '🟢 Go' : v === 'moderate' ? '🟡 Mod' : '🔴 Rest'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Correlations */}
      {(sleepCorrelation || stressCorrelation) && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{STRINGS.correlations}</Text>
          {sleepCorrelation && (
            <View style={styles.correlationCard}>
              <Text style={styles.correlationTitle}>😴 {sleepCorrelation.factor} ↔ HRV</Text>
              <Text style={styles.correlationInterpretation}>
                {sleepCorrelation.interpretation}
              </Text>
              <Text style={styles.correlationValue}>
                r = {sleepCorrelation.correlation.toFixed(2)} · {sleepCorrelation.sampleSize}{' '}
                sessions
              </Text>
            </View>
          )}
          {stressCorrelation && (
            <View style={styles.correlationCard}>
              <Text style={styles.correlationTitle}>😰 {stressCorrelation.factor} ↔ HRV</Text>
              <Text style={styles.correlationInterpretation}>
                {stressCorrelation.interpretation}
              </Text>
              <Text style={styles.correlationValue}>
                r = {stressCorrelation.correlation.toFixed(2)} · {stressCorrelation.sampleSize}{' '}
                sessions
              </Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 40 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, color: COLORS.textSecondary, fontWeight: '600' },
  emptyHint: { fontSize: 14, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },
  emptyCta: {
    marginTop: 24,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  emptyCtaText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  trendBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  trendIcon: { fontSize: 32 },
  trendLabel: { fontSize: 18, fontWeight: '700' },
  trendPercent: { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },
  section: { marginTop: 24 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sparklineWrapper: { alignItems: 'center' },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  highlightRow: { flexDirection: 'row', gap: 12 },
  highlightCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  highlightEmoji: { fontSize: 24, marginBottom: 4 },
  highlightValue: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  highlightLabel: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  verdictRow: { flexDirection: 'row', gap: 12 },
  verdictItem: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  verdictCount: { fontSize: 28, fontWeight: '700' },
  verdictLabel: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  correlationCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  correlationTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  correlationValue: { fontSize: 12, color: COLORS.textMuted, marginTop: 8 },
  correlationInterpretation: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
