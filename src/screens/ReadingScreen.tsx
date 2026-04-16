import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Device } from 'react-native-ble-plx';
import { RootStackParamList } from '../navigation/AppNavigator';
import { CountdownTimer } from '../components/CountdownTimer';
import { RRPlot } from '../components/RRPlot';
import { StatCard } from '../components/StatCard';
import { COLORS } from '../constants/colors';
import { useBleRecording } from '../ble/useBleRecording';
import { scanForDevices, isPolarH10 } from '../ble/bleManager';
import { requestBlePermissions, showPermissionBlockedAlert } from '../ble/permissions';
import { computeHrvMetrics } from '../hrv/metrics';
import { computeBaseline } from '../hrv/baseline';
import { computeVerdict } from '../hrv/verdict';
import { saveSession } from '../database/sessionRepository';
import { getDailyReadings } from '../database/sessionRepository';
import { loadSettings } from '../database/settingsRepository';
import { generateId } from '../utils/uuid';
import { ARTIFACT_WARNING_THRESHOLD } from '../constants/defaults';
import { STRINGS } from '../constants/strings';
import { BreathingExercise, BREATHING_PRESETS } from '../components/BreathingExercise';
import { refreshWidget } from '../utils/widgetData';

type ReadingNavProp = NativeStackNavigationProp<RootStackParamList>;

type Phase = 'scanning' | 'breathing' | 'recording' | 'complete';

export function ReadingScreen() {
  const navigation = useNavigation<ReadingNavProp>();
  const [phase, setPhase] = useState<Phase>('scanning');
  const [devices, setDevices] = useState<Device[]>([]);
  const [recording, actions] = useBleRecording();
  const [stopScan, setStopScan] = useState<(() => void) | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [scanTimedOut, setScanTimedOut] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // Start scanning on mount
  useEffect(() => {
    let cancelled = false;
    const startScan = async () => {
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
          if (!cancelled) {
            setDevices((prev) => {
              if (prev.find((d) => d.id === device.id)) return prev;
              return [...prev, device];
            });
          }
        });
        if (!cancelled) {
          setStopScan(() => stop);
          // Show timeout message after scan completes
          setTimeout(() => {
            if (!cancelled) setScanTimedOut(true);
          }, 15000);
        }
      } catch (error) {
        console.error('Scan error:', error);
      }
    };
    startScan();
    return () => { cancelled = true; };
  }, []);

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
      setTimeout(() => setScanTimedOut(true), 15000);
    } catch (error) {
      console.error('Rescan error:', error);
    }
  }, []);

  const selectDevice = useCallback(async (device: Device) => {
    if (connecting) return;
    setConnecting(true);
    stopScan?.();
    setSelectedDeviceId(device.id);
    setPhase('breathing');
  }, [stopScan, connecting]);

  const startAfterBreathing = useCallback(async () => {
    if (!selectedDeviceId) return;
    setPhase('recording');
    await actions.startRecording(selectedDeviceId);
  }, [selectedDeviceId, actions]);

  // Auto-transition to complete when recording stops with data
  useEffect(() => {
    if (!recording.isRecording && recording.rrIntervals.length > 0 && phase === 'recording') {
      handleComplete();
    }
  }, [recording.isRecording]);

  const handleComplete = useCallback(async () => {
    setPhase('complete');
    actions.stopRecording();

    const rrIntervals = recording.rrIntervals;
    if (rrIntervals.length < 10) {
      Alert.alert('Insufficient Data', 'Not enough RR intervals were recorded. Please try again.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return;
    }

    try {
      const metrics = computeHrvMetrics(rrIntervals);
      const settings = await loadSettings();
      const dailyReadings = await getDailyReadings(settings.baselineWindowDays);
      const baseline = computeBaseline(dailyReadings, settings.baselineWindowDays);
      const verdict = computeVerdict(metrics.rmssd, baseline, settings);

      const session = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        durationSeconds: recording.elapsedSeconds,
        rrIntervals,
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
      };

      await saveSession(session);
      refreshWidget().catch(() => {}); // Fire and forget
      navigation.replace('Log', { sessionId: session.id });
    } catch (error) {
      console.error('Failed to save session:', error);
      Alert.alert('Error', 'Failed to save session. Please try again.');
      navigation.goBack();
    }
  }, [recording, actions, navigation]);

  const handleFinishEarly = useCallback(() => {
    actions.stopRecording();
  }, [actions]);

  const artifactRate = useMemo(() =>
    recording.rrIntervals.length > 0
      ? computeHrvMetrics(recording.rrIntervals).artifactRate
      : 0,
    [recording.rrIntervals]
  );
  const showArtifactWarning = artifactRate > ARTIFACT_WARNING_THRESHOLD;

  // Scanning phase
  if (phase === 'scanning') {
    const polarDevices = devices.filter(isPolarH10);
    const otherDevices = devices.filter((d) => !isPolarH10(d));

    return (
      <View style={styles.container}>
        <Text style={styles.title}>{STRINGS.connectToSensor}</Text>
        {!scanTimedOut || devices.length > 0 ? (
          <>
            <Text style={styles.subtitle}>{STRINGS.scanningForDevices}</Text>
            <ActivityIndicator size="large" color={COLORS.accent} style={{ marginVertical: 20 }} />
          </>
        ) : (
          <View style={styles.timeoutContainer}>
            <Text style={styles.timeoutEmoji}>📡</Text>
            <Text style={styles.timeoutText}>{STRINGS.noDevicesFound}</Text>
            <Text style={styles.timeoutHint}>Make sure your heart rate monitor is on and nearby</Text>
            <TouchableOpacity style={styles.rescanButton} activeOpacity={0.7} onPress={restartScan} accessibilityRole="button" accessibilityLabel="Scan again for heart rate monitors">
              <Text style={styles.rescanButtonText}>Scan Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {polarDevices.length > 0 && (
          <View>
            <Text style={styles.sectionLabel}>Polar H10</Text>
            {polarDevices.map((device) => (
              <TouchableOpacity
                key={device.id}
                style={styles.deviceButton}
                onPress={() => selectDevice(device)}
                accessibilityRole="button"
                accessibilityLabel={`Connect to ${device.name || 'Polar H10'}`}
              activeOpacity={0.7}
               >
                <Text style={styles.deviceName}>{device.name || 'Polar H10'}</Text>
                <Text style={styles.deviceId}>{device.id.slice(-8)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {otherDevices.length > 0 && (
          <View>
            <Text style={styles.sectionLabel}>Other HR Monitors</Text>
            {otherDevices.map((device) => (
              <TouchableOpacity
                key={device.id}
                style={styles.deviceButton}
                onPress={() => selectDevice(device)}
                accessibilityRole="button"
                accessibilityLabel={`Connect to ${device.name || 'Unknown Device'}`}
              activeOpacity={0.7}
               >
                <Text style={styles.deviceName}>{device.name || 'Unknown Device'}</Text>
                <Text style={styles.deviceId}>{device.id.slice(-8)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Cancel scanning"
           activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Breathing phase
  if (phase === 'breathing') {
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
  if (phase === 'recording') {
    return (
      <View style={styles.container}>
        <Text style={styles.connectionStatus}>
          {recording.connectionState === 'connected' ? '🟢 Connected' :
           recording.connectionState === 'connecting' ? '🟡 Connecting...' :
           recording.connectionState === 'reconnecting' ? '🟠 Reconnecting...' :
           recording.connectionState === 'error' ? '🔴 Error' : '⚪ Disconnected'}
        </Text>

        {recording.error && (
          <Text style={styles.errorText}>{recording.error}</Text>
        )}

        <CountdownTimer remainingSeconds={recording.remainingSeconds} />

        <View style={styles.liveStats}>
          <StatCard label={STRINGS.heartRate} value={recording.currentHr > 0 ? `${recording.currentHr}` : '--'} unit={STRINGS.bpm} />
          <StatCard label={STRINGS.rrCount} value={`${recording.rrIntervals.length}`} />
        </View>

        <RRPlot rrIntervals={recording.rrIntervals} width={340} height={120} />

        {showArtifactWarning && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>⚠️ High artifact rate ({(artifactRate * 100).toFixed(1)}%). Check sensor contact.</Text>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  connectionStatus: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.danger,
    marginBottom: 12,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  deviceButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  deviceId: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  cancelButton: {
    marginTop: 32,
    padding: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.textSecondary,
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
  timeoutContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  timeoutEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  timeoutText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  timeoutHint: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  rescanButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  rescanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
});
