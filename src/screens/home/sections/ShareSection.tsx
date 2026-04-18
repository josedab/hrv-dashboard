import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';

export interface ShareSectionProps {
  onShare: () => void;
}

export function ShareSection({ onShare }: ShareSectionProps) {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onShare}
      accessibilityRole="button"
      accessibilityLabel="Share today's verdict"
      activeOpacity={0.7}
    >
      <Text style={styles.buttonText}>📤 Share Verdict</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { fontSize: 16, fontWeight: '700', color: COLORS.accent },
});
