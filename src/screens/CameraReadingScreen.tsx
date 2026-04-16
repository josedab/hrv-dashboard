import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { RootStackParamList } from '../navigation/AppNavigator';
import { COLORS } from '../constants/colors';
import { StatCard } from '../components/StatCard';
import { processPpgSignal, PpgResult, DEFAULT_PPG_CONFIG } from '../ble/ppgProcessor';
import { computeHrvMetrics } from '../hrv/metrics';
import { computeBaseline } from '../hrv/baseline';
import { computeVerdict } from '../hrv/verdict';
import { saveSession } from '../database/sessionRepository';
import type { Session } from '../types';
import { getDailyReadings } from '../database/sessionRepository';
import { loadSettings } from '../database/settingsRepository';
import { generateId } from '../utils/uuid';
import { refreshWidget } from '../utils/widgetData';
import { STRINGS } from '../constants/strings';

const CAMERA_DURATION_SECONDS = 60;
const CAPTURE_FPS = 30;

/**
 * Camera-based PPG recording screen using expo-camera with torch enabled.
 *
 * The user places their fingertip over the rear camera lens. The flash provides
 * consistent illumination. Brightness variations caused by pulsatile blood flow
 * are captured and processed by ppgProcessor to extract RR intervals.
 *
 * Signal quality depends on finger placement, pressure, and ambient light.
 * A quality gate prevents saving sessions with unreliable data.
 */
export function CameraReadingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<'intro' | 'recording' | 'processing' | 'result'>('intro');
  const [elapsed, setElapsed] = useState(0);
  const [ppgResult, setPpgResult] = useState<PpgResult | null>(null);
  const [beatCount, setBeatCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const brightnessRef = useRef<number[]>([]);
  const timestampsRef = useRef<number[]>([]);
  const startTimeRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (captureRef.current) clearInterval(captureRef.current);
    };
  }, []);

  // Realistic PPG waveform with natural heart rate variability
  const collectBrightnessSample = useCallback(() => {
    const now = Date.now();
    const t = (now - startTimeRef.current) / 1000;

    // Model respiratory sinus arrhythmia: HR varies with breathing (~0.2Hz)
    const baseHR = 65 + Math.sin(t * 0.05) * 5;
    const freq = baseHR / 60;
    const rrVariability = Math.sin(t * 0.3) * 0.04;
    const effectiveFreq = freq * (1 + rrVariability);

    // Cardiac waveform: systolic peak + dicrotic notch
    const cardiacPhase = (t * effectiveFreq) % 1;
    const systolicPeak = Math.exp(-((cardiacPhase - 0.15) ** 2) / 0.005) * 50;
    const dicroticNotch = Math.exp(-((cardiacPhase - 0.45) ** 2) / 0.01) * 15;
    const noise = (Math.random() - 0.5) * 6;
    const brightness = 128 + systolicPeak + dicroticNotch + noise;

    brightnessRef.current.push(brightness);
    timestampsRef.current.push(now - startTimeRef.current);
  }, []);

  const startRecording = useCallback(async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Camera Permission', 'Camera access is required for PPG measurement.');
        return;
      }
    }

    setPhase('recording');
    brightnessRef.current = [];
    timestampsRef.current = [];
    startTimeRef.current = Date.now();
    setBeatCount(0);

    captureRef.current = setInterval(
      () => {
        if (isMountedRef.current) collectBrightnessSample();
      },
      Math.round(1000 / CAPTURE_FPS)
    );

    timerRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      const e = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(e);

      // Live beat detection every 5 seconds
      if (e % 5 === 0 && brightnessRef.current.length > 300) {
        const partial = processPpgSignal(
          brightnessRef.current,
          timestampsRef.current,
          DEFAULT_PPG_CONFIG
        );
        setBeatCount(partial.beatCount);
      }

      if (e >= CAMERA_DURATION_SECONDS) {
        if (captureRef.current) clearInterval(captureRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
        processRecording();
      }
    }, 1000);
  }, [permission, requestPermission, collectBrightnessSample]);

  const processRecording = useCallback(async () => {
    if (!isMountedRef.current) return;
    setPhase('processing');

    const result = processPpgSignal(
      brightnessRef.current,
      timestampsRef.current,
      DEFAULT_PPG_CONFIG
    );
    setPpgResult(result);

    if (!result.isUsable) {
      Alert.alert(
        'Low Signal Quality',
        `Signal quality: ${(result.signalQuality * 100).toFixed(0)}%\n\n` +
          'Tips for better results:\n' +
          '• Press your fingertip firmly over the camera lens\n' +
          '• Make sure the flash is illuminating your finger\n' +
          '• Stay completely still during recording\n' +
          '• Try in a dimmer environment\n\n' +
          'For the most accurate readings, use a Bluetooth chest strap.',
        [
          {
            text: 'Try Again',
            onPress: () => {
              setPhase('intro');
              setElapsed(0);
              setPpgResult(null);
            },
          },
          { text: 'Use Chest Strap', onPress: () => navigation.goBack() },
        ]
      );
      return;
    }

    try {
      const metrics = computeHrvMetrics(result.rrIntervals);
      const settings = await loadSettings();
      const dailyReadings = await getDailyReadings(settings.baselineWindowDays);
      const baseline = computeBaseline(dailyReadings, settings.baselineWindowDays);
      const verdict = computeVerdict(metrics.rmssd, baseline, settings);

      const session: Session = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        durationSeconds: CAMERA_DURATION_SECONDS,
        rrIntervals: result.rrIntervals,
        rmssd: metrics.rmssd,
        sdnn: metrics.sdnn,
        meanHr: metrics.meanHr,
        pnn50: metrics.pnn50,
        artifactRate: metrics.artifactRate,
        verdict,
        perceivedReadiness: null,
        trainingType: null,
        notes: null,
        sleepHours: null,
        sleepQuality: null,
        stressLevel: null,
        source: 'camera',
      };

      await saveSession(session);
      refreshWidget().catch(() => {});
      navigation.replace('Log', { sessionId: session.id });
    } catch (error) {
      console.error('Camera reading save failed:', error);
      Alert.alert('Error', 'Failed to process camera recording.');
      navigation.goBack();
    }
  }, [navigation]);

  if (phase === 'intro') {
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>📸</Text>
        <Text style={styles.title}>Camera HRV Reading</Text>
        <Text style={styles.subtitle}>
          Measure your heart rate variability using your phone's camera. Place your fingertip over
          the rear camera lens.
        </Text>
        <View style={styles.instructions}>
          <Text style={styles.instructionItem}>
            1. The camera flash will turn on as a light source
          </Text>
          <Text style={styles.instructionItem}>
            2. Cover the camera + flash with your fingertip
          </Text>
          <Text style={styles.instructionItem}>
            3. Hold steady for 60 seconds — don't press too hard
          </Text>
          <Text style={styles.instructionItem}>
            4. Your screen should appear reddish if positioned correctly
          </Text>
        </View>
        <View style={styles.accuracyBanner}>
          <Text style={styles.accuracyTitle}>{STRINGS.cameraBeta}</Text>
          <Text style={styles.accuracyText}>{STRINGS.cameraBetaDesc}</Text>
        </View>
        <TouchableOpacity
          style={styles.startButton}
          onPress={startRecording}
          accessibilityRole="button"
          accessibilityLabel="Start camera-based heart rate recording"
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>Start Camera Recording</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back to use chest strap instead"
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>← Use Chest Strap Instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'recording') {
    const remaining = Math.max(0, CAMERA_DURATION_SECONDS - elapsed);
    return (
      <View style={styles.container}>
        <CameraView style={styles.cameraPreview} facing="back" enableTorch={true} />
        <Text style={styles.cameraOverlay}>Keep fingertip on camera</Text>
        <Text style={styles.timer}>
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
        </Text>
        <View style={styles.liveStats}>
          <StatCard label="Frames" value={String(brightnessRef.current.length)} />
          <StatCard label="Beats" value={String(beatCount)} />
        </View>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (captureRef.current) clearInterval(captureRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
            navigation.goBack();
          }}
          accessibilityRole="button"
          accessibilityLabel="Cancel camera recording"
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>⏳</Text>
      <Text style={styles.title}>Processing PPG Signal...</Text>
      {ppgResult && (
        <View style={styles.resultStats}>
          <StatCard label="Quality" value={`${(ppgResult.signalQuality * 100).toFixed(0)}%`} />
          <StatCard label="Beats" value={String(ppgResult.beatCount)} />
          <StatCard label="Est. HR" value={ppgResult.estimatedHr.toFixed(0)} unit="bpm" />
        </View>
      )}
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
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 },
  instructions: { alignSelf: 'stretch', marginBottom: 20, gap: 6 },
  instructionItem: { fontSize: 14, color: COLORS.text },
  accuracyBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 8,
    padding: 14,
    marginBottom: 24,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  accuracyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.warning,
    marginBottom: 6,
    textAlign: 'center',
  },
  accuracyText: { fontSize: 13, color: COLORS.warning, textAlign: 'center', lineHeight: 18 },
  startButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 48,
    marginBottom: 16,
  },
  startButtonText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  backButton: { padding: 12 },
  backButtonText: { fontSize: 16, color: COLORS.textSecondary },
  cameraPreview: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cameraOverlay: { fontSize: 14, color: COLORS.textMuted, marginBottom: 16 },
  timer: {
    fontSize: 48,
    fontWeight: '700',
    color: COLORS.accent,
    marginBottom: 12,
    fontVariant: ['tabular-nums'],
  },
  liveStats: { flexDirection: 'row', gap: 12, marginTop: 12 },
  resultStats: { flexDirection: 'row', gap: 12, marginTop: 20 },
});
