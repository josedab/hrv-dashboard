import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VerdictDisplay } from '../../../components/VerdictDisplay';
import { COLORS } from '../../../constants/colors';
import { STRINGS } from '../../../constants/strings';
import { Session } from '../../../types';

export interface VerdictSectionProps {
  session: Session | null;
  baselineMedian?: number;
}

export function VerdictSection({ session, baselineMedian }: VerdictSectionProps) {
  if (session) {
    return (
      <VerdictDisplay
        verdict={session.verdict}
        rmssd={session.rmssd}
        size="large"
        baselineValue={baselineMedian}
        percentOfBaseline={baselineMedian ? session.rmssd / baselineMedian : undefined}
      />
    );
  }
  return (
    <View style={styles.noReading}>
      <Text style={styles.noReadingEmoji}>💤</Text>
      <Text style={styles.noReadingText}>{STRINGS.noReadingYet}</Text>
      <Text style={styles.noReadingHint}>
        Put on your HR monitor and take a 5-minute reading to see your readiness verdict.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  noReading: { alignItems: 'center', paddingVertical: 40 },
  noReadingEmoji: { fontSize: 48, marginBottom: 12 },
  noReadingText: { fontSize: 18, color: COLORS.textSecondary },
  noReadingHint: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
});
