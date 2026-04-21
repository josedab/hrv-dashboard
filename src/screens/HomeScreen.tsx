/** Home screen — today's verdict, sparkline trend, recovery score, and start-reading CTA. */
import React, { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { WorkoutCard } from '../components/WorkoutCard';
import { COLORS } from '../constants/colors';
import { shareVerdict } from '../utils/profiles';

import { HeaderSection } from './home/sections/HeaderSection';
import { VerdictSection } from './home/sections/VerdictSection';
import { RecoverySection } from './home/sections/RecoverySection';
import { SparklineSection } from './home/sections/SparklineSection';
import { StatsSection } from './home/sections/StatsSection';
import { StartReadingSection } from './home/sections/StartReadingSection';
import { ShareSection } from './home/sections/ShareSection';
import { RecoveryInfoModal } from './home/RecoveryInfoModal';
import { useHomeData } from './home/useHomeData';

type HomeNavProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Top-level Home screen. Loads today's data via {@link useHomeData} and
 * delegates rendering to focused section components under `./home/sections/`.
 */
export function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const insets = useSafeAreaInsets();
  const data = useHomeData();
  const [showRecoveryInfo, setShowRecoveryInfo] = useState(false);

  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    []
  );

  if (data.loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  const session = data.todaySession;
  const hasReading = session !== null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      refreshControl={
        <RefreshControl
          refreshing={data.refreshing}
          onRefresh={data.refresh}
          tintColor={COLORS.accent}
        />
      }
    >
      <HeaderSection dateLabel={dateLabel} streak={data.streak} />

      <VerdictSection session={session} baselineMedian={data.baselineMedian} />

      {data.recoveryScore && (
        <RecoverySection
          recoveryScore={data.recoveryScore}
          weeklyLoad={data.weeklyLoad}
          onShowInfo={() => setShowRecoveryInfo(true)}
        />
      )}

      {hasReading && session && (
        <View style={styles.workoutWrap}>
          <WorkoutCard session={session} />
        </View>
      )}

      <SparklineSection data={data.sparklineData} baselineMedian={data.baselineMedian} />

      {hasReading && session && <StatsSection session={session} />}

      {!hasReading && (
        <StartReadingSection
          onStart={() => navigation.navigate('Reading')}
          onStartOrthostatic={() => navigation.navigate('Orthostatic')}
          onStartCamera={() => navigation.navigate('CameraReading')}
        />
      )}

      {hasReading && session && <ShareSection onShare={() => shareVerdict(session)} />}

      <RecoveryInfoModal visible={showRecoveryInfo} onClose={() => setShowRecoveryInfo(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  workoutWrap: { paddingHorizontal: 20 },
});
