import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants/colors';

interface ToastProps {
  message: string;
  visible: boolean;
  duration?: number;
  type?: 'success' | 'error' | 'info';
  onHide?: () => void;
  /** Optional action button (e.g. "Undo"). When pressed, fires onAction and dismisses. */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Animated toast notification that slides down from the top.
 * Auto-hides after the specified duration. Optionally renders an action button.
 */
export function Toast({
  message,
  visible,
  duration = 2500,
  type = 'success',
  onHide,
  actionLabel,
  onAction,
}: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -100, duration: 300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => onHide?.());
      }, duration);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible, duration, translateY, opacity, onHide]);

  if (!visible) return null;

  const bgColor =
    type === 'success' ? COLORS.success : type === 'error' ? COLORS.danger : COLORS.accent;

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: bgColor, transform: [{ translateY }], opacity }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <View style={styles.row}>
        <Text style={styles.text}>
          {type === 'success' ? '✓ ' : type === 'error' ? '✗ ' : 'ℹ '}
          {message}
        </Text>
        {actionLabel && onAction && (
          <TouchableOpacity
            onPress={() => {
              onAction();
              onHide?.();
            }}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={styles.actionButton}
            activeOpacity={0.7}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  text: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  actionText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 14,
  },
});
