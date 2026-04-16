import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { STRINGS } from '../constants/strings';

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

interface ConnectionPillProps {
  state: ConnectionState;
}

interface PillSpec {
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}

function specFor(state: ConnectionState): PillSpec {
  switch (state) {
    case 'connected':
      return {
        label: STRINGS.connectionConnected,
        color: COLORS.success,
        icon: 'bluetooth',
      };
    case 'connecting':
      return {
        label: STRINGS.connectionConnecting,
        color: COLORS.warning,
        icon: 'sync',
      };
    case 'reconnecting':
      return {
        label: STRINGS.connectionReconnecting,
        color: COLORS.warning,
        icon: 'refresh',
      };
    case 'error':
      return {
        label: STRINGS.connectionError,
        color: COLORS.danger,
        icon: 'alert-circle',
      };
    case 'disconnected':
    case 'idle':
    default:
      return {
        label: STRINGS.connectionDisconnected,
        color: COLORS.textMuted,
        icon: 'bluetooth-outline',
      };
  }
}

/**
 * Reusable pill displaying BLE connection state with consistent color + icon.
 */
export function ConnectionPill({ state }: ConnectionPillProps) {
  const spec = specFor(state);
  return (
    <View
      style={[styles.pill, { borderColor: spec.color }]}
      accessibilityRole="text"
      accessibilityLabel={`Connection status: ${spec.label}`}
    >
      <Ionicons name={spec.icon} size={14} color={spec.color} />
      <Text style={[styles.label, { color: spec.color }]}>{spec.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
