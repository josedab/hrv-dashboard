/** Modal for entering/confirming encryption passphrases (sync, backup, share). */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS } from '../constants/colors';
import { STRINGS } from '../constants/strings';

interface PassphraseModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  minLength?: number;
  onCancel: () => void;
  onConfirm: (passphrase: string) => void;
}

/**
 * Cross-platform passphrase entry modal. Replaces Alert.prompt (iOS-only).
 */
export function PassphraseModal({
  visible,
  title,
  message,
  confirmLabel = STRINGS.confirm,
  minLength = 1,
  onCancel,
  onConfirm,
}: PassphraseModalProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setValue('');
      setError(null);
    }
  }, [visible]);

  const handleConfirm = () => {
    if (value.length < minLength) {
      setError(`Passphrase must be at least ${minLength} characters.`);
      return;
    }
    onConfirm(value);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TextInput
            style={styles.input}
            placeholder="Passphrase"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            value={value}
            onChangeText={(t) => {
              setValue(t);
              if (error) setError(null);
            }}
            accessibilityLabel="Passphrase"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={STRINGS.cancel}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonSecondaryText}>{STRINGS.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonPrimaryText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    backgroundColor: COLORS.surfaceLight,
    color: COLORS.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  error: {
    color: COLORS.danger,
    fontSize: 13,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 8,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
  },
  buttonSecondaryText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonPrimary: {
    backgroundColor: COLORS.accent,
  },
  buttonPrimaryText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
