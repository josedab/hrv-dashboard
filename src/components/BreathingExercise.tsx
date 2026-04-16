import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { COLORS } from '../constants/colors';

export interface BreathingPreset {
  name: string;
  inhale: number;
  hold: number;
  exhale: number;
}

export const BREATHING_PRESETS: BreathingPreset[] = [
  { name: 'Coherence', inhale: 5, hold: 0, exhale: 5 },
  { name: 'Box', inhale: 4, hold: 4, exhale: 4 },
  { name: 'Relaxing', inhale: 4, hold: 4, exhale: 6 },
];

type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'idle';

interface Props {
  durationSeconds?: number;
  preset?: BreathingPreset;
  onComplete: () => void;
  onSkip: () => void;
}

/**
 * Guided breathing component with animated expanding/contracting circle.
 * Standardizes autonomic state before HRV measurement.
 */
export function BreathingExercise({
  durationSeconds = 120,
  preset = BREATHING_PRESETS[0],
  onComplete,
  onSkip,
}: Props) {
  const [phase, setPhase] = useState<BreathPhase>('idle');
  const [phaseLabel, setPhaseLabel] = useState('Get Ready');
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const reduceMotionRef = useRef(false);

  // Check for reduced motion preference
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotionRef.current = enabled;
    });
  }, []);

  const cycleDuration = preset.inhale + preset.hold + preset.exhale;

  const clearAllTimers = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (cycleRef.current) {
      clearInterval(cycleRef.current);
      cycleRef.current = null;
    }
    if (phaseTimerRef.current) {
      clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    scaleAnim.stopAnimation();
  }, [scaleAnim]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearAllTimers();
    };
  }, [clearAllTimers]);

  const runBreathCycle = useCallback(() => {
    if (!isMountedRef.current) return;

    // Inhale
    setPhase('inhale');
    setPhaseLabel('Breathe In');
    const animDuration = reduceMotionRef.current ? 100 : preset.inhale * 1000;
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: animDuration,
      useNativeDriver: true,
    }).start();

    // After inhale → hold or exhale
    phaseTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;

      if (preset.hold > 0) {
        setPhase('hold');
        setPhaseLabel('Hold');
        holdTimerRef.current = setTimeout(() => {
          if (!isMountedRef.current) return;
          setPhase('exhale');
          setPhaseLabel('Breathe Out');
          Animated.timing(scaleAnim, {
            toValue: 0.5,
            duration: reduceMotionRef.current ? 100 : preset.exhale * 1000,
            useNativeDriver: true,
          }).start();
        }, preset.hold * 1000);
      } else {
        setPhase('exhale');
        setPhaseLabel('Breathe Out');
        Animated.timing(scaleAnim, {
          toValue: 0.5,
          duration: preset.exhale * 1000,
          useNativeDriver: true,
        }).start();
      }
    }, preset.inhale * 1000);
  }, [preset, scaleAnim]);

  const handleStart = useCallback(() => {
    setIsRunning(true);
    setElapsed(0);
    const startTime = Date.now();

    // Countdown timer
    countdownRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      const e = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(e);
      if (e >= durationSeconds) {
        clearAllTimers();
        setIsRunning(false);
        onComplete();
      }
    }, 1000);

    // Start first breathing cycle immediately
    runBreathCycle();

    // Repeat breathing cycle
    cycleRef.current = setInterval(() => {
      if (isMountedRef.current) runBreathCycle();
    }, cycleDuration * 1000);
  }, [durationSeconds, cycleDuration, runBreathCycle, clearAllTimers, onComplete]);

  const handleDone = useCallback(() => {
    clearAllTimers();
    setIsRunning(false);
    onComplete();
  }, [clearAllTimers, onComplete]);

  const remaining = Math.max(0, durationSeconds - elapsed);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  if (!isRunning && elapsed === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Guided Breathing</Text>
        <Text style={styles.subtitle}>
          Calm your nervous system before recording for more consistent HRV data.
        </Text>
        <Text style={styles.presetName}>{preset.name} Breathing</Text>
        <Text style={styles.presetDetail}>
          {preset.inhale}s in{preset.hold > 0 ? ` · ${preset.hold}s hold` : ''} · {preset.exhale}s
          out
        </Text>

        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStart}
          accessibilityRole="button"
          accessibilityLabel={`Begin ${preset.name} breathing exercise, ${Math.floor(durationSeconds / 60)} minutes`}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>Begin ({Math.floor(durationSeconds / 60)} min)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip breathing and start recording"
          activeOpacity={0.7}
        >
          <Text style={styles.skipButtonText}>Skip → Start Recording</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text
        style={styles.timer}
        accessibilityRole="timer"
        accessibilityLabel={`${minutes} minutes ${seconds} seconds remaining`}
      >
        {minutes}:{String(seconds).padStart(2, '0')}
      </Text>

      <View
        style={styles.circleContainer}
        accessible={true}
        accessibilityRole="progressbar"
        accessibilityLabel={`Breathing phase: ${phaseLabel}`}
        accessibilityLiveRegion="polite"
      >
        <Animated.View
          style={[
            styles.circle,
            {
              transform: [{ scale: scaleAnim }],
              backgroundColor:
                phase === 'inhale'
                  ? COLORS.accent
                  : phase === 'hold'
                    ? COLORS.warning
                    : phase === 'exhale'
                      ? COLORS.success
                      : COLORS.surfaceLight,
            },
          ]}
        />
      </View>

      <Text style={styles.phaseLabel}>{phaseLabel}</Text>

      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleDone}
        accessibilityRole="button"
        accessibilityLabel="Finish breathing and start recording"
        activeOpacity={0.7}
      >
        <Text style={styles.skipButtonText}>Done → Start Recording</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  presetName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  presetDetail: {
    fontSize: 15,
    color: COLORS.textMuted,
    marginBottom: 40,
  },
  timer: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 40,
  },
  circleContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.6,
  },
  phaseLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 40,
  },
  startButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 48,
    marginBottom: 16,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  skipButton: {
    padding: 12,
    minHeight: 44,
  },
  skipButtonText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});
