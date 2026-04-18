/**
 * Coherence biofeedback screen.
 *
 * Displays a breathing-pacer ring (no animation library — pure layout)
 * and continuously computes a coherence score from accumulated RR
 * intervals. In this build the RR intervals come from a simulated source
 * if no chest strap is paired; once integrated with the real BLE
 * pipeline, swap `useSimulatedRr` with the live RR stream from
 * {@link ../ble/bleManager}.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import {
  computeCoherence,
  computePacerState,
  RESONANCE_PACER,
  PacerConfig,
} from '../biofeedback/coherence';

const RING_SIZE = 220;
const PHASE_LABELS: Record<string, string> = {
  inhale: 'Inhale',
  exhale: 'Exhale',
  'hold-top': 'Hold',
  'hold-bottom': 'Hold',
};

function useSimulatedRr(intervalMs: number = 1000): number[] {
  const [rr, setRr] = useState<number[]>([]);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      // Simulate a moderately-coherent ~6 brpm signal as user breathes along.
      const next = 900 + 100 * Math.sin(2 * Math.PI * 0.1 * elapsed);
      setRr((prev) => {
        const out = [...prev, next];
        return out.length > 600 ? out.slice(-600) : out;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return rr;
}

export function CoherenceScreen({ pacer = RESONANCE_PACER }: { pacer?: PacerConfig }) {
  const [tick, setTick] = useState(0);
  const startRef = useRef(Date.now());
  const rr = useSimulatedRr();
  const result = computeCoherence(rr);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 50);
    return () => clearInterval(id);
  }, []);

  const elapsedSeconds = (Date.now() - startRef.current) / 1000;
  const state = computePacerState(elapsedSeconds, pacer);
  const ringScale = 0.5 + 0.5 * state.scale;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Coherence training</Text>
      <Text style={styles.subtitle}>
        Breathe with the ring. Inhale {pacer.inhaleSeconds}s · Exhale {pacer.exhaleSeconds}s
      </Text>

      <View style={styles.demoBadge} accessibilityLabel="Demo mode notice">
        <Text style={styles.demoBadgeText}>DEMO · simulated RR signal</Text>
      </View>
      <Text style={styles.demoNote}>
        The coherence score below is computed from a synthetic ~6 brpm RR signal, not your live
        chest-strap data. A future build will tap into the BLE recording stream.
      </Text>

      <View style={styles.ringWrap}>
        <View
          style={[
            styles.ring,
            {
              transform: [{ scale: ringScale }],
              borderColor: state.phase === 'inhale' ? COLORS.success : COLORS.accent,
            },
          ]}
          accessibilityLabel={`${state.phase} phase`}
        />
        <Text style={styles.phaseText}>{PHASE_LABELS[state.phase] ?? state.phase}</Text>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metricCol}>
          <Text style={styles.metricValue}>{Math.round(result.score)}</Text>
          <Text style={styles.metricLabel}>Coherence</Text>
        </View>
        <View style={styles.metricCol}>
          <Text style={styles.metricValue}>
            {result.peakFrequencyHz ? (60 * result.peakFrequencyHz).toFixed(1) : '—'}
          </Text>
          <Text style={styles.metricLabel}>Peak (brpm)</Text>
        </View>
        <View style={styles.metricCol}>
          <Text style={styles.metricValue}>{state.cycleCount}</Text>
          <Text style={styles.metricLabel}>Cycles</Text>
        </View>
      </View>

      {/* Force re-render via tick state */}
      <View style={{ height: 0, opacity: 0 }}>
        <Text>{tick}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 24,
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginTop: 12 },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, marginBottom: 16 },
  demoBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.warning ?? '#F59E0B',
    marginBottom: 8,
  },
  demoBadgeText: { color: '#0F172A', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  demoNote: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 24,
    lineHeight: 16,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 6,
    position: 'absolute',
  },
  phaseText: {
    fontSize: 22,
    color: COLORS.text,
    fontWeight: '700',
  },
  metrics: {
    flexDirection: 'row',
    marginTop: 48,
    gap: 32,
  },
  metricCol: { alignItems: 'center', minWidth: 80 },
  metricValue: { color: COLORS.text, fontSize: 28, fontWeight: '700' },
  metricLabel: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
});
