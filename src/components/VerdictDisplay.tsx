import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VerdictType } from '../types';
import { VERDICT_INFO } from '../constants/verdicts';
import { COLORS, VERDICT_COLORS } from '../constants/colors';

interface VerdictDisplayProps {
  verdict: VerdictType | null;
  rmssd: number | null;
  size?: 'large' | 'small';
}

export function VerdictDisplay({ verdict, rmssd, size = 'large' }: VerdictDisplayProps) {
  const isLarge = size === 'large';

  if (!verdict) {
    const baselineLabel = rmssd !== null
      ? `Readiness verdict: Building Baseline. rMSSD ${rmssd.toFixed(1)} milliseconds`
      : 'Readiness verdict: Building Baseline';

    return (
      <View
        style={[styles.container, isLarge && styles.containerLarge]}
        accessibilityRole="text"
        accessibilityLabel={baselineLabel}
      >
        <Text style={[styles.emoji, isLarge && styles.emojiLarge]}>📊</Text>
        <Text style={[styles.label, isLarge && styles.labelLarge, { color: COLORS.noVerdict }]}>
          Building Baseline
        </Text>
        {rmssd !== null && (
          <Text style={[styles.rmssd, isLarge && styles.rmssdLarge]}>
            rMSSD: {rmssd.toFixed(1)} ms
          </Text>
        )}
        <Text style={styles.sublabel}>
          Need more days of readings to compute verdict
        </Text>
      </View>
    );
  }

  const info = VERDICT_INFO[verdict];
  const color = VERDICT_COLORS[verdict];

  const verdictLabel = rmssd !== null
    ? `Readiness verdict: ${info.label}. rMSSD ${rmssd.toFixed(1)} milliseconds`
    : `Readiness verdict: ${info.label}`;

  return (
    <View
      style={[styles.container, isLarge && styles.containerLarge]}
      accessibilityRole="text"
      accessibilityLabel={verdictLabel}
    >
      <Text style={[styles.emoji, isLarge && styles.emojiLarge]}>{info.emoji}</Text>
      <Text style={[styles.label, isLarge && styles.labelLarge, { color }]}>
        {info.label}
      </Text>
      {rmssd !== null && (
        <Text style={[styles.rmssd, isLarge && styles.rmssdLarge]}>
          rMSSD: {rmssd.toFixed(1)} ms
        </Text>
      )}
      <Text style={styles.description}>{info.description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 16,
  },
  containerLarge: {
    paddingVertical: 32,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emojiLarge: {
    fontSize: 64,
    marginBottom: 16,
  },
  label: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  labelLarge: {
    fontSize: 32,
    marginBottom: 8,
  },
  rmssd: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  rmssdLarge: {
    fontSize: 20,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  sublabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
});
