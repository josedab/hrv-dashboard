import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Rect } from 'react-native-svg';
import { COLORS } from '../constants/colors';

interface RRPlotProps {
  rrIntervals: number[];
  width?: number;
  height?: number;
  maxPoints?: number;
}

export function RRPlot({
  rrIntervals,
  width = 320,
  height = 120,
  maxPoints = 60,
}: RRPlotProps) {
  const padding = 12;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Show only the most recent maxPoints intervals
  const visibleData = rrIntervals.slice(-maxPoints);

  if (visibleData.length < 2) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.placeholder}>Waiting for RR data...</Text>
      </View>
    );
  }

  const min = Math.min(...visibleData) * 0.9;
  const max = Math.max(...visibleData) * 1.1;
  const range = max - min || 1;

  const points = visibleData.map((value, index) => {
    const x = padding + (index / (visibleData.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return `${x},${y}`;
  });

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} rx={8} fill={COLORS.surface} />
        <Polyline
          points={points.join(' ')}
          fill="none"
          stroke={COLORS.accent}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>RR Intervals (ms)</Text>
        <Text style={styles.label}>{visibleData[visibleData.length - 1]?.toFixed(0)} ms</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  placeholder: {
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingTop: 48,
    fontSize: 14,
  },
  labelContainer: {
    position: 'absolute',
    bottom: 4,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
});
