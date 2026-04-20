/** Reading screen — BLE scan → device selection → live RR recording → results display. */
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BleDevice } from '../ble/bleManager';
import { RootStackParamList } from '../navigation/AppNavigator';
import { CountdownTimer } from '../components/CountdownTimer';
import { RRPlot } from '../components/RRPlot';
import { StatCard } from '../components/StatCard';
import { COLORS } from '../constants/colors';
import { useBleRecording } from '../ble/useBleRecording';
import { scanForDevices } from '../ble/bleManager';
import { requestBlePermissions, showPermissionBlockedAlert } from '../ble/permissions';
import { computeHrvMetrics } from '../hrv/metrics';
import { loadSettings } from '../database/settingsRepository';
import { ARTIFACT_WARNING_THRESHOLD } from '../constants/defaults';
import { STRINGS } from '../constants/strings';
import { BreathingExercise, BREATHING_PRESETS } from '../components/BreathingExercise';
import { ConnectionPill } from '../components/ConnectionPill';
import { useSessionPersistence } from '../hooks/useSessionPersistence';
import { useReadingFlow } from '../hooks/useReadingFlow';
import { ScanPhase } from './reading/ScanPhase';

type ReadingNavProp = NativeStackNavigationProp<RootStackParamList>;

const SCAN_TIMEOUT_MS = 15000;

export function ReadingScreen() {
  const navigation = useNavigation<ReadingNavProp>();
  const flow = useReadingFlow();
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [recording, actions] = useBleRecording();
  const [stopScan, setStopScan] = useState<(() => void) | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [scanTimedOut, setScanTimedOut] = useState(false);
  const [breathingEnabled, setBreathingEnabled] = useState<boolean>(true);
  const [pairedDeviceId, setPairedDeviceId] = useState<string | null>(null);

  const startRecordingForDevice = useCallback(
    (deviceId: string) => {
      actions.startRecording(deviceId).catch((err) => {
        console.error('startRecording failed:', err);
      });
    },
    [actions]
  );

  const goToBreathingOrRecording = useCallback(
    (deviceId: string) => {
      const skipBreathing = !breathingEnabled;
      flow.selectDevice(deviceId, skipBreathing);
      if (skipBreathing) {
        startRecordingForDevice(deviceId);
      }
    },
    [breathingEnabled, flow, startRecordingForDevice]
  );

  // Start scanning on mount, with auto-connect to paired device when present
  useEffect(() => {
    let cancelled = false;
    const startScan = async () => {
      const settings = await loadSettings();
      if (cancelled) return;
      setBreathingEnabled(settings.breathingExerciseEnabled);
      setPairedDeviceId(settings.pairedDeviceId);

      const permissionStatus = await requestBlePermissions();
      if (permissionStatus === 'blocked') {
        showPermissionBlockedAlert();
        return;
      }
      if (permissionStatus === 'denied') {
        return;
      }
      try {
        const stop = await scanForDevices((device) => {
          if (cancelled) return;
          // Auto-select the paired device the moment we see it
          if (settings.pairedDeviceId && device.id === settings.pairedDeviceId) {
            stop();
            goToBreathingOrRecording(device.id);
            return;
          }
          setDevices((prev) => {
            if (prev.find((d) => d.id === device.id)) return prev;
            return [...prev, device];
          });
        });
        if (!cancelled) {
          setStopScan(() => stop);
          setTimeout(() => {
            if (!cancelled) setScanTimedOut(true);
          }, SCAN_TIMEOUT_MS);
        }
      } catch (error) {
        console.error('Scan error:', error);
      }
    };
    startScan();
    return () => {
      cancelled = true;
    };
  }, [goToBreathingOrRecording]);

  const restartScan = useCallback(async () => {
    setDevices([]);
    setScanTimedOut(false);
    try {
      const stop = await scanForDevices((device) => {
        setDevices((prev) => {
          if (prev.find((d) => d.id === device.id)) return prev;
          return [...prev, device];
        });
      });
      setStopScan(() => stop);
      setTimeout(() => setScanTimedOut(true), SCAN_TIMEOUT_MS);
    } catch (error) {
      console.error('Rescan error:', error);
    }
  }, []);

  const selectDevice = useCallback(
    async (device: BleDevice) => {
      if (connecting) return;
      setConnecting(true);
      stopScan?.();
      goToBreathingOrRecording(device.id);
    },
    [stopScan, connecting, goToBreathingOrRecording]
  );

  const startAfterBreathing = useCallback(async () => {
    if (flow.phase.kind !== 'breathing') return;
    const deviceId = flow.phase.deviceId;
    flow.finishBreathing();
    await actions.startRecording(deviceId);
  }, [flow, actions]);

  const { finalize } = useSessionPersistence();

  const handleComplete = useCallback(async () => {
    flow.finishRecording();
    actions.stopRecording();

    const rrIntervals = recording.rrIntervals;
    if (rrIntervals.length < 10) {
      Alert.alert('Insufficient Data', 'Not enough RR intervals were recorded. Please try again.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return;
    }

    const result = await finalize({
      rrIntervals,
      durationSeconds: recording.elapsedSeconds,
      source: 'chest_strap',
    });
    if (result.kind === 'error') {
      Alert.alert('Error', 'Failed to save session. Please try again.');
      navigation.goBack();
    }
  }, [recording.rrIntervals, recording.elapsedSeconds, actions, navigation, finalize, flow]);

  // Auto-transition to complete when recording stops with data.
  // Phase is read via a ref to avoid re-running the effect when phase changes;
  // the trigger should only be the recording becoming inactive.
  const phaseKindRef = useRef(flow.phase.kind);
  useEffect(() => {
    phaseKindRef.current = flow.phase.kind;
  }, [flow.phase.kind]);
  useEffect(() => {
    if (
      !recording.isRecording &&
      recording.rrIntervals.length > 0 &&
      phaseKindRef.current === 'recording'
    ) {
      handleComplete();
    }
  }, [recording.isRecording, recording.rrIntervals.length, handleComplete]);

  const handleFinishEarly = useCallback(() => {
    actions.stopRecording();
  }, [actions]);

  const artifactRate = useMemo(
    () =>
      recording.rrIntervals.length > 0 ? computeHrvMetrics(recording.rrIntervals).artifactRate : 0,
    [recording.rrIntervals]
  );
  const showArtifactWarning = artifactRate > ARTIFACT_WARNING_THRESHOLD;

  // Scanning phase
  if (flow.phase.kind === 'scanning') {
    return (
      <ScanPhase
        devices={devices}
        pairedDeviceId={pairedDeviceId}
        scanTimedOut={scanTimedOut}
        onSelectDevice={selectDevice}
        onRescan={restartScan}
        onCancel={() => navigation.goBack()}
      />
    );
  }

  // Breathing phase
  if (flow.phase.kind === 'breathing') {
    return (
      <BreathingExercise
        durationSeconds={120}
        preset={BREATHING_PRESETS[0]}
        onComplete={startAfterBreathing}
        onSkip={startAfterBreathing}
      />
    );
  }

  // Recording phase
  if (flow.phase.kind === 'recording') {
    return (
      <View style={styles.container}>
        <View style={styles.pillRow}>
          <ConnectionPill
            state={
              recording.connectionState as
                | 'connected'
                | 'connecting'
                | 'reconnecting'
                | 'disconnected'
                | 'error'
                | 'idle'
            }
          />
        </View>

        {recording.error && <Text style={styles.errorText}>{recording.error}</Text>}

        <CountdownTimer remainingSeconds={recording.remainingSeconds} />

        <View style={styles.liveStats}>
          <StatCard
            label={STRINGS.heartRate}
            value={recording.currentHr > 0 ? `${recording.currentHr}` : '--'}
            unit={STRINGS.bpm}
          />
          <StatCard label={STRINGS.rrCount} value={`${recording.rrIntervals.length}`} />
        </View>

        <RRPlot rrIntervals={recording.rrIntervals} width={340} height={120} />

        {showArtifactWarning && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              ⚠️ High artifact rate ({(artifactRate * 100).toFixed(1)}%). Check sensor contact.
            </Text>
          </View>
        )}

        {recording.canFinishEarly && (
          <TouchableOpacity
            style={styles.finishButton}
            onPress={handleFinishEarly}
            accessibilityRole="button"
            accessibilityLabel="Finish recording early"
            activeOpacity={0.7}
          >
            <Text style={styles.finishButtonText}>Finish Early</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Complete phase (brief loading state)
  return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={COLORS.accent} />
      <Text style={[styles.subtitle, { marginTop: 16 }]}>Processing...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.danger,
    marginBottom: 12,
    textAlign: 'center',
  },
  pillRow: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  liveStats: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 16,
    width: '100%',
  },
  warningBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    width: '100%',
  },
  warningText: {
    fontSize: 14,
    color: COLORS.warning,
    textAlign: 'center',
  },
  finishButton: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 20,
  },
  finishButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
});
