/**
 * Guided morning recording protocol screen.
 *
 * Orchestrates the 3-phase morning flow using {@link useMorningProtocol}:
 *   Phase 1: Guided breathing (2 min) — BreathingExercise component
 *   Phase 2: HRV recording (5 min) — countdown + RR accumulation
 *   Phase 3: Log entry (optional) — redirect to LogScreen
 *
 * Supports "Quick mode" (skip breathing, 3 min recording).
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants/colors';
import {
  getPhaseSequence,
  computeProtocolState,
  shouldAutoAdvance,
  DEFAULT_PROTOCOL_CONFIG,
  QUICK_PROTOCOL_CONFIG,
  ProtocolConfig,
  ProtocolPhase,
} from '../hooks/useMorningProtocol';

interface MorningProtocolScreenProps {
  quickMode?: boolean;
  onComplete?: (rrIntervals: number[]) => void;
}

const PHASE_TITLES: Record<ProtocolPhase, string> = {
  breathing: 'Guided Breathing',
  recording: 'HRV Recording',
  log: 'Session Log',
  complete: 'Complete',
};

const PHASE_DESCRIPTIONS: Record<ProtocolPhase, string> = {
  breathing: 'Calm your nervous system for more consistent HRV data.',
  recording: 'Stay still. Your heart rate variability is being measured.',
  log: 'Add optional notes about your sleep, stress, and training.',
  complete: 'Your morning protocol is complete!',
};

export function MorningProtocolScreen({
  quickMode = false,
  onComplete,
}: MorningProtocolScreenProps) {
  const config: ProtocolConfig = quickMode ? QUICK_PROTOCOL_CONFIG : DEFAULT_PROTOCOL_CONFIG;
  const phases = getPhaseSequence(config);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseElapsed, setPhaseElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(Date.now());

  const state = computeProtocolState(phases, phaseIndex, phaseElapsed, config);

  // Timer for timed phases
  useEffect(() => {
    if (state.phase === 'log' || state.phase === 'complete') return;

    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      setPhaseElapsed(elapsed);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phaseIndex, state.phase]);

  // Auto-advance when phase duration expires
  useEffect(() => {
    if (shouldAutoAdvance(state.phase, phaseElapsed, config)) {
      advancePhase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseElapsed]);

  const advancePhase = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (phaseIndex < phases.length - 1) {
      setPhaseIndex((i) => i + 1);
      setPhaseElapsed(0);
    }
    if (phases[phaseIndex + 1] === 'complete') {
      onComplete?.([]);
    }
  }, [phaseIndex, phases, onComplete]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Step indicator */}
      <View style={styles.stepsRow}>
        {phases
          .filter((p) => p !== 'complete')
          .map((phase, i) => (
            <View
              key={phase}
              style={[
                styles.stepDot,
                i < state.stepNumber
                  ? styles.stepDotCompleted
                  : i === state.stepNumber - 1
                    ? styles.stepDotActive
                    : styles.stepDotPending,
              ]}
              accessibilityLabel={`Step ${i + 1}: ${PHASE_TITLES[phase]}`}
            />
          ))}
      </View>

      <Text style={styles.stepLabel}>
        Step {state.stepNumber} of {state.totalSteps}
      </Text>
      <Text style={styles.title}>{PHASE_TITLES[state.phase]}</Text>
      <Text style={styles.description}>{PHASE_DESCRIPTIONS[state.phase]}</Text>

      {/* Timer display for timed phases */}
      {(state.phase === 'breathing' || state.phase === 'recording') && (
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>{formatTime(state.phaseRemaining)}</Text>
          <View style={styles.progressBarBg}>
            <View
              style={[styles.progressBarFill, { width: `${state.phaseProgress * 100}%` }]}
              accessibilityLabel={`${Math.round(state.phaseProgress * 100)}% complete`}
            />
          </View>
        </View>
      )}

      {/* Complete state */}
      {state.phase === 'complete' && (
        <View style={styles.completeContainer}>
          <Text style={styles.completeEmoji}>✅</Text>
          <Text style={styles.completeText}>Morning protocol complete!</Text>
        </View>
      )}

      {/* Action buttons */}
      {state.canAdvance && state.phase !== 'complete' && (
        <TouchableOpacity
          style={styles.advanceButton}
          onPress={advancePhase}
          accessibilityRole="button"
          accessibilityLabel={state.phase === 'breathing' ? 'Skip to recording' : 'Next step'}
        >
          <Text style={styles.advanceButtonText}>
            {state.phase === 'breathing'
              ? 'Skip → Start Recording'
              : state.phase === 'recording'
                ? 'Finish Early'
                : 'Continue'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stepDotCompleted: { backgroundColor: COLORS.success },
  stepDotActive: { backgroundColor: COLORS.accent },
  stepDotPending: { backgroundColor: COLORS.surfaceLight },
  stepLabel: { fontSize: 13, color: COLORS.textMuted, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  description: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  timerContainer: { alignItems: 'center', marginBottom: 32 },
  timerText: { fontSize: 56, fontWeight: '200', color: COLORS.text, marginBottom: 16 },
  progressBarBg: {
    width: 200,
    height: 4,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 2,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
  completeContainer: { alignItems: 'center', marginBottom: 32 },
  completeEmoji: { fontSize: 48, marginBottom: 12 },
  completeText: { fontSize: 18, color: COLORS.text, fontWeight: '600' },
  advanceButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  advanceButtonText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
});
