/**
 * Tests for VerdictDisplay component logic.
 *
 * These tests validate the component's rendering decisions without
 * requiring a full React Native runtime. We mock react-native to
 * test component output as plain React elements.
 */

// Mock react-native before imports
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
}));

import React from 'react';

// Use a lightweight render helper
function getComponentOutput(element: React.ReactElement): string {
  const json = JSON.stringify(element, (key, value) => {
    if (key === '_owner' || key === '_store' || key === 'ref' || key === '$$typeof') return undefined;
    return value;
  });
  return json;
}

import { VerdictDisplay } from '../../src/components/VerdictDisplay';

describe('VerdictDisplay', () => {
  describe('with null verdict (building baseline)', () => {
    it('renders "Building Baseline" label', () => {
      const element = VerdictDisplay({ verdict: null, rmssd: null });
      const output = getComponentOutput(element);
      expect(output).toContain('Building Baseline');
    });

    it('renders rMSSD when provided', () => {
      const element = VerdictDisplay({ verdict: null, rmssd: 42.5 });
      const output = getComponentOutput(element);
      expect(output).toContain('42.5');
      expect(output).toContain('Building Baseline');
    });

    it('includes the 📊 emoji', () => {
      const element = VerdictDisplay({ verdict: null, rmssd: null });
      const output = getComponentOutput(element);
      expect(output).toContain('📊');
    });
  });

  describe('with go_hard verdict', () => {
    it('renders Go Hard label', () => {
      const element = VerdictDisplay({ verdict: 'go_hard', rmssd: 45.0 });
      const output = getComponentOutput(element);
      expect(output).toContain('Go Hard');
    });

    it('renders rMSSD value', () => {
      const element = VerdictDisplay({ verdict: 'go_hard', rmssd: 45.0 });
      const output = getComponentOutput(element);
      expect(output).toContain('45.0');
    });

    it('renders the green emoji', () => {
      const element = VerdictDisplay({ verdict: 'go_hard', rmssd: 45.0 });
      const output = getComponentOutput(element);
      expect(output).toContain('🟢');
    });
  });

  describe('with moderate verdict', () => {
    it('renders Moderate label', () => {
      const element = VerdictDisplay({ verdict: 'moderate', rmssd: 35.0 });
      const output = getComponentOutput(element);
      expect(output).toContain('Moderate');
    });

    it('renders the amber emoji', () => {
      const element = VerdictDisplay({ verdict: 'moderate', rmssd: 35.0 });
      const output = getComponentOutput(element);
      expect(output).toContain('🟡');
    });
  });

  describe('with rest verdict', () => {
    it('renders Rest or Easy label', () => {
      const element = VerdictDisplay({ verdict: 'rest', rmssd: 25.0 });
      const output = getComponentOutput(element);
      expect(output).toContain('Rest');
    });

    it('renders the red emoji', () => {
      const element = VerdictDisplay({ verdict: 'rest', rmssd: 25.0 });
      const output = getComponentOutput(element);
      expect(output).toContain('🔴');
    });
  });

  describe('baseline context', () => {
    it('shows baseline percentage when provided', () => {
      const element = VerdictDisplay({
        verdict: 'go_hard',
        rmssd: 45.0,
        baselineValue: 42.0,
        percentOfBaseline: 45.0 / 42.0,
      });
      const output = getComponentOutput(element);
      expect(output).toContain('107% of baseline');
      expect(output).toContain('42.0 ms');
    });

    it('does not show baseline when not provided', () => {
      const element = VerdictDisplay({
        verdict: 'go_hard',
        rmssd: 45.0,
      });
      const output = getComponentOutput(element);
      expect(output).not.toContain('% of baseline');
    });

    it('shows correct percentage for moderate verdict', () => {
      const element = VerdictDisplay({
        verdict: 'moderate',
        rmssd: 36.0,
        baselineValue: 42.0,
        percentOfBaseline: 36.0 / 42.0,
      });
      const output = getComponentOutput(element);
      expect(output).toContain('86% of baseline');
    });
  });

  describe('size variants', () => {
    it('accepts large size (default)', () => {
      const element = VerdictDisplay({ verdict: 'go_hard', rmssd: 45.0, size: 'large' });
      expect(element).toBeTruthy();
    });

    it('accepts small size', () => {
      const element = VerdictDisplay({ verdict: 'go_hard', rmssd: 45.0, size: 'small' });
      expect(element).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('includes accessible label for verdict', () => {
      const element = VerdictDisplay({ verdict: 'go_hard', rmssd: 45.0 });
      const output = getComponentOutput(element);
      expect(output).toContain('Readiness verdict: Go Hard');
    });

    it('includes accessible label with rMSSD', () => {
      const element = VerdictDisplay({ verdict: 'go_hard', rmssd: 45.0 });
      const output = getComponentOutput(element);
      expect(output).toContain('45.0 milliseconds');
    });

    it('includes accessible label for building baseline', () => {
      const element = VerdictDisplay({ verdict: null, rmssd: null });
      const output = getComponentOutput(element);
      expect(output).toContain('Building Baseline');
    });
  });
});
