import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Sparkline } from '../components/Sparkline';
import { COLORS, VERDICT_COLORS } from '../constants/colors';
import { Session } from '../types';
import { getSessionsPaginated, getSessionCount, getRecentSessions } from '../database/sessionRepository';
import { VERDICT_INFO } from '../constants/verdicts';
import { formatDate } from '../utils/date';

type HistoryNavProp = NativeStackNavigationProp<RootStackParamList>;

const PAGE_SIZE = 30;

export function HistoryScreen() {
  const navigation = useNavigation<HistoryNavProp>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [chartData, setChartData] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

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

  const renderSession = useCallback(({ item }: { item: Session }) => {
    const verdictInfo = item.verdict ? VERDICT_INFO[item.verdict] : null;
    const verdictColor = item.verdict ? VERDICT_COLORS[item.verdict] : COLORS.noVerdict;

    return (
      <TouchableOpacity
        style={styles.sessionItem}
        onPress={() => navigation.navigate('SessionDetail', { sessionId: item.id })}
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
  }, [navigation]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        contentContainerStyle={styles.listContent}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>History</Text>
            {chartData.length >= 2 && (
              <View style={styles.chartContainer}>
                <Text style={styles.chartLabel}>rMSSD — Last 30 Days</Text>
                <Sparkline data={chartData} width={340} height={100} />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No sessions yet</Text>
            <Text style={styles.emptySubtext}>Complete your first reading to see history</Text>
          </View>
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
    paddingTop: 60,
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
});
