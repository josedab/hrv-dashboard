import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sparkline } from '../../../components/Sparkline';
import { COLORS } from '../../../constants/colors';
import { STRINGS } from '../../../constants/strings';

export interface SparklineSectionProps {
  data: number[];
  baselineMedian?: number;
}

export function SparklineSection({ data, baselineMedian }: SparklineSectionProps) {
  if (data.length < 2) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>{STRINGS.rmssdLast7Days}</Text>
      <Sparkline
        data={data}
        width={320}
        height={80}
        showBaseline={baselineMedian !== undefined}
        baselineValue={baselineMedian}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginVertical: 20 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
});
