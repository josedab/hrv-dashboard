import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { STRINGS } from '../../../constants/strings';

export interface HeaderSectionProps {
  /** Pre-formatted human-readable date label (e.g. "Friday, April 17"). */
  dateLabel: string;
  streak: number;
}

export function HeaderSection({ dateLabel, streak }: HeaderSectionProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.date}>{dateLabel}</Text>
      {streak > 0 && <Text style={styles.streak}>{STRINGS.dayStreak(streak)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  date: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  streak: { fontSize: 14, color: COLORS.warning, fontWeight: '600' },
});
