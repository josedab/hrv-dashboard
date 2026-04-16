import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../constants/colors';
import { formatDuration } from '../utils/date';
import { RECORDING_DURATION_SECONDS } from '../constants/defaults';

interface CountdownTimerProps {
  remainingSeconds: number;
  size?: number;
}

export function CountdownTimer({ remainingSeconds, size = 180 }: CountdownTimerProps) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = remainingSeconds / RECORDING_DURATION_SECONDS;
  const strokeDashoffset = circumference * (1 - progress);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timerLabel =
    minutes > 0
      ? `${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds} second${seconds !== 1 ? 's' : ''} remaining`
      : `${seconds} second${seconds !== 1 ? 's' : ''} remaining`;

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessibilityRole="timer"
      accessibilityLabel={timerLabel}
    >
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.surfaceLight}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.accent}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.textContainer}>
        <Text style={styles.time}>{formatDuration(remainingSeconds)}</Text>
        <Text style={styles.label}>remaining</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  time: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.text,
  },
  label: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
