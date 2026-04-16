import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

interface ReadinessSliderProps {
  value: number | null;
  onChange: (value: number) => void;
}

const READINESS_LABELS: Record<number, string> = {
  1: 'Very Low',
  2: 'Low',
  3: 'Moderate',
  4: 'Good',
  5: 'Excellent',
};

export function ReadinessSlider({ value, onChange }: ReadinessSliderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Perceived Readiness</Text>
      <View style={styles.buttons}>
        {[1, 2, 3, 4, 5].map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.button,
              value === level && styles.buttonSelected,
            ]}
            onPress={() => onChange(level)}
            accessibilityRole="button"
            accessibilityLabel={`Readiness level ${level}: ${READINESS_LABELS[level]}`}
            accessibilityState={{ selected: value === level }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.buttonText,
                value === level && styles.buttonTextSelected,
              ]}
            >
              {level}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {value !== null && (
        <Text style={styles.label}>{READINESS_LABELS[value]}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  button: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  buttonTextSelected: {
    color: COLORS.text,
  },
  label: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
