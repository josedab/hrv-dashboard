/** Metric display card showing a label, value, optional unit, and warning state. */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  warning?: boolean;
}

export function StatCard({ label, value, unit, warning = false }: StatCardProps) {
  const accessLabel = unit ? `${label}: ${value} ${unit}` : `${label}: ${value}`;
  return (
    <View
      style={[styles.card, warning && styles.cardWarning]}
      accessibilityRole="text"
      accessibilityLabel={accessLabel}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, warning && styles.valueWarning]}>{value}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    minWidth: 100,
    flex: 1,
  },
  cardWarning: {
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  valueWarning: {
    color: COLORS.warning,
  },
  unit: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});
