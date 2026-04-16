import React from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { COLORS } from '../constants/colors';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showBaseline?: boolean;
  baselineValue?: number;
}

function SparklineInner({
  data,
  width = 200,
  height = 60,
  color = COLORS.accent,
  showBaseline = false,
  baselineValue,
}: SparklineProps) {
  if (data.length < 2) {
    return <View style={{ width, height }} />;
  }

  const padding = 8;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return { x, y };
  });

  const pointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');
  const lastPoint = points[points.length - 1];

  const baselineY = baselineValue !== undefined
    ? padding + chartHeight - ((baselineValue - min) / range) * chartHeight
    : undefined;

  return (
    <View
      style={{ width, height }}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={`Trend chart with ${data.length} data points. Latest value: ${data[data.length - 1]?.toFixed(1) ?? 'unknown'}${baselineValue ? `, baseline: ${baselineValue.toFixed(1)}` : ''}`}
    >
      <Svg width={width} height={height}>
        {showBaseline && baselineY !== undefined && (
          <Line
            x1={padding}
            y1={baselineY}
            x2={width - padding}
            y2={baselineY}
            stroke={COLORS.textMuted}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        )}
        <Polyline
          points={pointsStr}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={4}
          fill={color}
        />
      </Svg>
    </View>
  );
}

export const Sparkline = React.memo(SparklineInner);
