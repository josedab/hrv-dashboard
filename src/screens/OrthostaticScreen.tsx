import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { StatCard } from '../components/StatCard';
import { COLORS } from '../constants/colors';
import { useBleRecording } from '../ble/useBleRecording';
import { computeOrthostaticResult, OrthostaticResult } from '../hrv/orthostatic';

type OrthoPhase = 'intro' | 'supine' | 'transition' | 'standing' | 'result';

const SUPINE_DURATION = 150;
const STANDING_DURATION = 150;
const TRANSITION_DURATION = 10;

export function OrthostaticScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [phase, setPhase] = useState<OrthoPhase>('intro');
  const [recording, actions] = useBleRecording();
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<OrthostaticResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseStartRef = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Use refs to track RR interval split point — avoids stale closures
  const supineEndIndexRef = useRef(0);
  const isMountedRef = useRef(true);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    pulseAnim.stopAnimation();
  }, [pulseAnim]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  const startTimer = useCallback(
    (duration: number, onComplete: () => void) => {
      clearTimer();
      phaseStartRef.current = Date.now();
      setElapsed(0);

      timerRef.current = setInterval(() => {
        if (!isMountedRef.current) return;
        const e = Math.floor((Date.now() - phaseStartRef.current) / 1000);
        setElapsed(e);
        if (e >= duration) {
          clearTimer();
          onComplete();
        }
      }, 1000);
    },
    [clearTimer]
  );

  const _handleSupineComplete = useCallback(() => {
    if (!isMountedRef.current) return;
    // Record how many RR intervals belong to the supine phase
    supineEndIndexRef.current = recording.rrIntervals.length;
    setPhase('transition');

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();

    startTimer(TRANSITION_DURATION, () => {
      if (!isMountedRef.current) return;
      pulseAnim.stopAnimation();
      setPhase('standing');

      startTimer(STANDING_DURATION, () => {
        if (!isMountedRef.current) return;
        const allRR = recording.rrIntervals;
        const splitIndex = supineEndIndexRef.current;
        const supineRR = allRR.slice(0, splitIndex);
        const standingRR = allRR.slice(splitIndex);

        actions.stopRecording();

        if (supineRR.length < 10 || standingRR.length < 10) {
          Alert.alert(
            'Insufficient Data',
            'Not enough RR intervals in one or both phases. Ensure good sensor contact throughout.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }

        const orthoResult = computeOrthostaticResult(supineRR, standingRR);
        setResult(orthoResult);
        setPhase('result');
      });
    });
  }, [recording.rrIntervals, startTimer, pulseAnim, actions, navigation]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  // Intro screen
  if (phase === 'intro') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Orthostatic Test</Text>
        <Text style={styles.subtitle}>
          A 5-minute test measuring your HRV response to standing up. More sensitive to overtraining
          than supine-only measurement.
        </Text>
        <View style={styles.phaseList}>
          <Text style={styles.phaseItem}>1️⃣ Lie down — 2.5 min supine recording</Text>
          <Text style={styles.phaseItem}>2️⃣ Stand up — 10 second transition</Text>
          <Text style={styles.phaseItem}>3️⃣ Stand still — 2.5 min standing recording</Text>
        </View>
        <Text style={styles.hint}>
          This test requires a connected HR monitor. Start a normal reading first to connect your
          device, then come back here.
        </Text>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Result screen
  if (phase === 'result' && result) {
    const scoreColor =
      result.reactivityScore >= 70
        ? COLORS.success
        : result.reactivityScore >= 40
          ? COLORS.warning
          : COLORS.danger;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Orthostatic Results</Text>

        <View style={styles.scoreCircle}>
          <Text style={[styles.scoreValue, { color: scoreColor }]}>{result.reactivityScore}</Text>
          <Text style={styles.scoreLabel}>Reactivity</Text>
        </View>

        <Text style={styles.interpretation}>{result.interpretation}</Text>

        <View style={styles.comparisonRow}>
          <View style={styles.comparisonColumn}>
            <Text style={styles.comparisonHeader}>Supine</Text>
            <StatCard label="rMSSD" value={result.supine.rmssd.toFixed(1)} unit="ms" />
            <StatCard label="HR" value={result.supine.meanHr.toFixed(0)} unit="bpm" />
          </View>
          <View style={styles.comparisonColumn}>
            <Text style={styles.comparisonHeader}>Standing</Text>
            <StatCard label="rMSSD" value={result.standing.rmssd.toFixed(1)} unit="ms" />
            <StatCard label="HR" value={result.standing.meanHr.toFixed(0)} unit="bpm" />
          </View>
        </View>

        <View style={styles.deltaRow}>
          <Text style={styles.deltaText}>
            Δ rMSSD: {result.deltaRmssd > 0 ? '+' : ''}
            {result.deltaRmssd.toFixed(1)} ms
          </Text>
          <Text style={styles.deltaText}>
            Δ HR: {result.deltaHr > 0 ? '+' : ''}
            {result.deltaHr.toFixed(0)} bpm
          </Text>
        </View>

        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Done, return to home"
          activeOpacity={0.8}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Active phases
  const phaseName =
    phase === 'supine'
      ? '🛌 Lie Still'
      : phase === 'transition'
        ? '🏃 Stand Up Now!'
        : phase === 'standing'
          ? '🧍 Stand Still'
          : '';
  const phaseDuration =
    phase === 'supine'
      ? SUPINE_DURATION
      : phase === 'transition'
        ? TRANSITION_DURATION
        : STANDING_DURATION;
  const remaining = Math.max(0, phaseDuration - elapsed);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <View style={styles.container}>
      <Animated.Text
        style={[
          styles.phaseEmoji,
          { transform: [{ scale: phase === 'transition' ? pulseAnim : 1 }] },
        ]}
      >
        {phase === 'supine' ? '🛌' : phase === 'transition' ? '⬆️' : '🧍'}
      </Animated.Text>
      <Text style={styles.activePhaseLabel}>{phaseName}</Text>
      <Text style={styles.timerText}>
        {mins}:{String(secs).padStart(2, '0')}
      </Text>

      {recording.currentHr > 0 && <Text style={styles.liveHr}>❤️ {recording.currentHr} bpm</Text>}

      <Text style={styles.rrCount}>{recording.rrIntervals.length} RR intervals</Text>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => {
          clearTimer();
          actions.stopRecording();
          navigation.goBack();
        }}
        accessibilityRole="button"
        accessibilityLabel="Cancel orthostatic test"
        activeOpacity={0.7}
      >
        <Text style={styles.cancelText}>Cancel Test</Text>
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
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  phaseList: { alignSelf: 'stretch', marginBottom: 24, gap: 8 },
  phaseItem: { fontSize: 16, color: COLORS.text, paddingVertical: 4 },
  hint: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginBottom: 32 },
  phaseEmoji: { fontSize: 64, marginBottom: 16 },
  activePhaseLabel: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  timerText: {
    fontSize: 48,
    fontWeight: '700',
    color: COLORS.accent,
    marginBottom: 24,
    fontVariant: ['tabular-nums'],
  },
  liveHr: { fontSize: 20, color: COLORS.text, marginBottom: 8 },
  rrCount: { fontSize: 14, color: COLORS.textMuted },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  scoreValue: { fontSize: 40, fontWeight: '700' },
  scoreLabel: { fontSize: 13, color: COLORS.textMuted },
  interpretation: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  comparisonRow: { flexDirection: 'row', gap: 16, marginBottom: 16, width: '100%' },
  comparisonColumn: { flex: 1, gap: 8 },
  comparisonHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 4,
  },
  deltaRow: { flexDirection: 'row', gap: 24, marginBottom: 24 },
  deltaText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '600' },
  doneButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  doneButtonText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  cancelButton: { padding: 12, minHeight: 44 },
  cancelText: { fontSize: 16, color: COLORS.textSecondary },
});
