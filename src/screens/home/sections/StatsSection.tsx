/** Home screen stats grid — rMSSD, SDNN, mean HR, pNN50, and artifact rate cards. */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatCard } from '../../../components/StatCard';
import { STRINGS } from '../../../constants/strings';
import { Session } from '../../../types';
import { ARTIFACT_WARNING_THRESHOLD } from '../../../constants/defaults';

export interface StatsSectionProps {
  session: Session;
}

export function StatsSection({ session }: StatsSectionProps) {
  const artifactWarning = session.artifactRate > ARTIFACT_WARNING_THRESHOLD;
  return (
    <>
      <View style={styles.statsRow}>
        <StatCard label={STRINGS.meanHr} value={session.meanHr.toFixed(0)} unit={STRINGS.bpm} />
        <StatCard label={STRINGS.sdnn} value={session.sdnn.toFixed(1)} unit={STRINGS.ms} />
        <StatCard
          label={STRINGS.artifacts}
          value={`${(session.artifactRate * 100).toFixed(1)}%`}
          warning={artifactWarning}
        />
      </View>
      <View style={styles.statsRow}>
        <StatCard label={STRINGS.pnn50} value={session.pnn50.toFixed(1)} unit={STRINGS.percent} />
        <StatCard
          label={STRINGS.duration}
          value={`${Math.floor(session.durationSeconds / 60)}m ${session.durationSeconds % 60}s`}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
});
