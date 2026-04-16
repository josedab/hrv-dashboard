import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Sparkline } from '../components/Sparkline';
import { COLORS, VERDICT_COLORS } from '../constants/colors';
import { STRINGS } from '../constants/strings';
import { Session, VerdictType } from '../types';
import {
  getSessionsPaginated,
  getSessionCount,
  getRecentSessions,
} from '../database/sessionRepository';
import { VERDICT_INFO } from '../constants/verdicts';
import { formatDate } from '../utils/date';

type HistoryNavProp = NativeStackNavigationProp<RootStackParamList>;

const PAGE_SIZE = 30;

type VerdictFilter = 'all' | VerdictType;

const FILTER_OPTIONS: { id: VerdictFilter; label: string; emoji: string }[] = [
  { id: 'all', label: STRINGS.filterAll, emoji: '◍' },
  { id: 'go_hard', label: STRINGS.filterGoHard, emoji: '🟢' },
  { id: 'moderate', label: STRINGS.filterModerate, emoji: '🟡' },
  { id: 'rest', label: STRINGS.filterRest, emoji: '🔴' },
];

export function HistoryScreen() {
  const navigation = useNavigation<HistoryNavProp>();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [chartData, setChartData] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<VerdictFilter>('all');

  const filteredSessions = useMemo(() => {
    if (filter === 'all') return sessions;
    return sessions.filter((s) => s.verdict === filter);
  }, [sessions, filter]);

  const loadData = useCallback(async () => {
    try {
      const [paginated, recent30, totalCount] = await Promise.all([
        getSessionsPaginated(PAGE_SIZE, 0),
        getRecentSessions(30),
        getSessionCount(),
      ]);
      setSessions(paginated);
      setChartData(recent30.map((s) => s.rmssd));
      setHasMore(paginated.length < totalCount);
    } catch (error) {
      console.error('Failed to load history:', error);
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

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = await getSessionsPaginated(PAGE_SIZE, sessions.length);
      if (nextPage.length === 0) {
        setHasMore(false);
      } else {
        setSessions((prev) => [...prev, ...nextPage]);
        setHasMore(nextPage.length === PAGE_SIZE);
      }
    } catch (error) {
      console.error('Failed to load more sessions:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, sessions.length]);

  const renderSession = useCallback(
    ({ item }: { item: Session }) => {
      const verdictInfo = item.verdict ? VERDICT_INFO[item.verdict] : null;
      const verdictColor = item.verdict ? VERDICT_COLORS[item.verdict] : COLORS.noVerdict;

      return (
        <TouchableOpacity
          style={styles.sessionItem}
          onPress={() => navigation.navigate('SessionDetail', { sessionId: item.id })}
          accessibilityRole="button"
          accessibilityLabel={`${formatDate(item.timestamp)}, ${verdictInfo?.label ?? 'No Verdict'}, rMSSD ${item.rmssd.toFixed(1)} milliseconds`}
          accessibilityHint="Opens session details"
          activeOpacity={0.7}
        >
          <View style={styles.sessionLeft}>
            <Text style={styles.sessionEmoji}>{verdictInfo?.emoji ?? '📊'}</Text>
            <View>
              <Text style={styles.sessionDate}>{formatDate(item.timestamp)}</Text>
              <Text style={[styles.sessionVerdict, { color: verdictColor }]}>
                {verdictInfo?.label ?? 'No Verdict'}
              </Text>
            </View>
          </View>
          <View style={styles.sessionRight}>
            <Text style={styles.sessionRmssd}>{item.rmssd.toFixed(1)}</Text>
            <Text style={styles.sessionUnit}>rMSSD</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [navigation]
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

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredSessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 12 }]}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>{STRINGS.history}</Text>
            {chartData.length >= 2 && (
              <View style={styles.chartContainer}>
                <Text style={styles.chartLabel}>{STRINGS.rmssdLast30Days}</Text>
                <Sparkline data={chartData} width={340} height={100} />
              </View>
            )}
            {sessions.length > 0 && (
              <View
                style={styles.filterRow}
                accessibilityRole="tablist"
                accessibilityLabel={STRINGS.filterByVerdict}
              >
                {FILTER_OPTIONS.map((opt) => {
                  const active = filter === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => setFilter(opt.id)}
                      style={[styles.chip, active && styles.chipActive]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${opt.label} filter`}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {opt.emoji} {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          sessions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{STRINGS.noSessionsYet}</Text>
              <Text style={styles.emptySubtext}>{STRINGS.noSessionsHint}</Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => navigation.navigate('Reading')}
                accessibilityRole="button"
                accessibilityLabel="Take your first reading"
                activeOpacity={0.8}
              >
                <Text style={styles.emptyCtaText}>❤️ {STRINGS.startReading}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No sessions match this filter</Text>
              <Text style={styles.emptySubtext}>Try a different verdict.</Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator size="small" color={COLORS.accent} style={{ paddingVertical: 16 }} />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  chartLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  sessionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sessionEmoji: {
    fontSize: 24,
  },
  sessionDate: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  sessionVerdict: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  sessionRight: {
    alignItems: 'flex-end',
  },
  sessionRmssd: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  sessionUnit: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
  },
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: COLORS.text,
  },
});
