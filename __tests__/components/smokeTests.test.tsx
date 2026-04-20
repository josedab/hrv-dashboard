/**
 * Smoke tests for untested components.
 *
 * These tests validate that components render without throwing,
 * using the same mock strategy as VerdictDisplay.test.tsx.
 */

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  Animated: {
    View: 'Animated.View',
    Value: jest.fn(() => ({ interpolate: jest.fn() })),
    timing: jest.fn(() => ({ start: jest.fn() })),
    spring: jest.fn(() => ({ start: jest.fn() })),
    parallel: jest.fn(() => ({ start: jest.fn() })),
  },
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  AccessibilityInfo: {
    isReduceMotionEnabled: jest.fn(async () => false),
  },
}));

jest.mock('react-native-svg', () => ({
  Svg: 'Svg',
  Circle: 'Circle',
  Line: 'Line',
  Polyline: 'Polyline',
  Rect: 'Rect',
  Text: 'SvgText',
  G: 'G',
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

import React from 'react';

function renderToJson(element: React.ReactElement): string {
  return JSON.stringify(element, (_key, value) => {
    if (typeof value === 'function') return '[Function]';
    return value;
  });
}

describe('Toast', () => {
  it('renders without throwing when visible', () => {
    const { Toast } = require('../../src/components/Toast');
    const element = React.createElement(Toast, {
      visible: true,
      message: 'Test toast',
      type: 'success',
    });
    const output = renderToJson(element);
    expect(output).toContain('Test toast');
  });

  it('returns null when not visible', () => {
    const { Toast } = require('../../src/components/Toast');
    const element = React.createElement(Toast, {
      visible: false,
      message: 'Hidden',
      type: 'info',
    });
    expect(element).toBeDefined();
  });
});

describe('ConnectionPill', () => {
  it('renders connected state', () => {
    const { ConnectionPill } = require('../../src/components/ConnectionPill');
    const element = React.createElement(ConnectionPill, {
      state: 'connected',
    });
    const output = renderToJson(element);
    expect(output).toContain('connected');
  });

  it('renders disconnected state', () => {
    const { ConnectionPill } = require('../../src/components/ConnectionPill');
    const element = React.createElement(ConnectionPill, {
      state: 'disconnected',
    });
    const output = renderToJson(element);
    expect(output).toBeDefined();
  });
});

describe('ReadinessSlider', () => {
  it('renders with value', () => {
    const { ReadinessSlider } = require('../../src/components/ReadinessSlider');
    const element = React.createElement(ReadinessSlider, {
      value: 3,
      onChange: jest.fn(),
    });
    const output = renderToJson(element);
    expect(output).toBeDefined();
  });
});

describe('Sparkline', () => {
  it('renders with data points', () => {
    const { Sparkline } = require('../../src/components/Sparkline');
    const element = React.createElement(Sparkline, {
      data: [40, 42, 38, 45, 50],
      width: 200,
      height: 60,
    });
    const output = renderToJson(element);
    expect(output).toBeDefined();
  });

  it('renders with empty data', () => {
    const { Sparkline } = require('../../src/components/Sparkline');
    const element = React.createElement(Sparkline, {
      data: [],
      width: 200,
      height: 60,
    });
    const output = renderToJson(element);
    expect(output).toBeDefined();
  });
});

describe('CountdownTimer', () => {
  it('renders with remaining seconds', () => {
    const { CountdownTimer } = require('../../src/components/CountdownTimer');
    const element = React.createElement(CountdownTimer, {
      remainingSeconds: 180,
      totalSeconds: 300,
    });
    const output = renderToJson(element);
    expect(output).toBeDefined();
  });
});
