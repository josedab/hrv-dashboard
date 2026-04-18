import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { STRINGS } from '../../../constants/strings';
import { RecoveryScore } from '../../../hrv/recovery';

function RecoveryBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? COLORS.success : value >= 40 ? COLORS.warning : COLORS.danger;
  return (
    <View style={styles.barContainer}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View
          style={[styles.barFill, { width: `${Math.min(value, 100)}%`, backgroundColor: color }]}
        />
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  );
}

export interface RecoverySectionProps {
  recoveryScore: RecoveryScore;
  weeklyLoad: number;
  onShowInfo: () => void;
}

export function RecoverySection({ recoveryScore, weeklyLoad, onShowInfo }: RecoverySectionProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>{STRINGS.recoveryScore}</Text>
        <TouchableOpacity
          onPress={onShowInfo}
          accessibilityRole="button"
          accessibilityLabel="What is the Recovery Score?"
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          activeOpacity={0.6}
        >
          <Text style={styles.infoBadge}>ⓘ</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <View style={styles.scoreCircle}>
          <Text style={styles.scoreValue}>{recoveryScore.score}</Text>
          <Text style={styles.scoreLabel}>{recoveryScore.label}</Text>
        </View>
        <View style={styles.components}>
          <RecoveryBar label="HRV" value={recoveryScore.components.hrv} />
          <RecoveryBar label="Sleep" value={recoveryScore.components.sleep} />
          <RecoveryBar label="Stress" value={recoveryScore.components.stress} />
          <RecoveryBar label="Readiness" value={recoveryScore.components.readiness} />
        </View>
      </View>
      {weeklyLoad > 0 && (
        <Text style={styles.weeklyLoadText}>📊 Weekly training load: {weeklyLoad}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  infoBadge: { fontSize: 18, color: COLORS.textMuted, paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: { fontSize: 28, fontWeight: '700', color: COLORS.text },
  scoreLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  components: { flex: 1, gap: 6 },
  barContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 60, fontSize: 12, color: COLORS.textMuted },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: COLORS.surfaceLight },
  barFill: { height: 6, borderRadius: 3 },
  barValue: { width: 24, fontSize: 12, color: COLORS.textSecondary, textAlign: 'right' },
  weeklyLoadText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 12,
    textAlign: 'center',
  },
});
