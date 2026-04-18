import React from 'react';
import { Modal, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

export interface RecoveryInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

export function RecoveryInfoModal({ visible, onClose }: RecoveryInfoModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>About the Recovery Score</Text>
          <Text style={styles.body}>
            A 0–100 estimate of how prepared your body is for hard training today, blended from four
            signals:
          </Text>
          <Text style={styles.bullet}>
            <Text style={styles.bulletKey}>HRV</Text> — today&apos;s rMSSD vs. your 7-day baseline.
          </Text>
          <Text style={styles.bullet}>
            <Text style={styles.bulletKey}>Sleep</Text> — last night&apos;s self-reported hours and
            quality.
          </Text>
          <Text style={styles.bullet}>
            <Text style={styles.bulletKey}>Stress</Text> — your morning stress rating (inverted).
          </Text>
          <Text style={styles.bullet}>
            <Text style={styles.bulletKey}>Readiness</Text> — your subjective readiness rating.
          </Text>
          <Text style={styles.footer}>
            The score is a rough guide, not medical advice. Trust how you feel.
          </Text>
          <TouchableOpacity style={styles.button} onPress={onClose} accessibilityRole="button">
            <Text style={styles.buttonText}>Got it</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  body: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 12 },
  bullet: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 4 },
  bulletKey: { fontWeight: '600', color: COLORS.text },
  footer: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginTop: 12,
    marginBottom: 16,
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
