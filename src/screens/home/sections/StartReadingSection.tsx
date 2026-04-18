import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { STRINGS } from '../../../constants/strings';

export interface StartReadingSectionProps {
  onStart: () => void;
  onStartOrthostatic: () => void;
  onStartCamera: () => void;
}

export function StartReadingSection({
  onStart,
  onStartOrthostatic,
  onStartCamera,
}: StartReadingSectionProps) {
  const [showMore, setShowMore] = useState(false);
  return (
    <View style={{ gap: 12, marginTop: 32 }}>
      <TouchableOpacity
        style={styles.startButton}
        onPress={onStart}
        accessibilityRole="button"
        accessibilityLabel="Start morning reading"
        activeOpacity={0.7}
      >
        <Text style={styles.startButtonText}>Start Reading</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setShowMore((s) => !s)}
        accessibilityRole="button"
        accessibilityLabel={STRINGS.moreWaysToRecord}
        accessibilityState={{ expanded: showMore }}
        activeOpacity={0.7}
        style={styles.moreToggle}
      >
        <Text style={styles.moreToggleText}>
          {showMore ? '▾' : '▸'} {STRINGS.moreWaysToRecord}
        </Text>
      </TouchableOpacity>
      {showMore && (
        <View style={{ gap: 12 }}>
          <TouchableOpacity
            style={[styles.startButton, styles.secondaryButton]}
            onPress={onStartOrthostatic}
            accessibilityRole="button"
            accessibilityLabel="Start orthostatic test"
            activeOpacity={0.7}
          >
            <Text style={[styles.startButtonText, { color: COLORS.accent }]}>
              🧍 Orthostatic Test
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.startButton, styles.secondaryButton]}
            onPress={onStartCamera}
            accessibilityRole="button"
            accessibilityLabel="Camera-based reading without chest strap (beta)"
            activeOpacity={0.7}
          >
            <Text style={[styles.startButtonText, { color: COLORS.accent }]}>
              📸 Camera Reading · Beta
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  startButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 32,
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  startButtonText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  moreToggle: { paddingVertical: 8, alignItems: 'center' },
  moreToggleText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
});
