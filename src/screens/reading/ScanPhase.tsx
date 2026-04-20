/** Scan phase UI — device list, timeout state, rescan button. Pure presentational. */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { BleDevice } from '../../ble/bleManager';
import { isPolarH10 } from '../../ble/bleManager';
import { COLORS } from '../../constants/colors';
import { STRINGS } from '../../constants/strings';

export interface ScanPhaseProps {
  devices: BleDevice[];
  pairedDeviceId: string | null;
  scanTimedOut: boolean;
  onSelectDevice: (device: BleDevice) => void;
  onRescan: () => void;
  onCancel: () => void;
}

export function ScanPhase({
  devices,
  pairedDeviceId,
  scanTimedOut,
  onSelectDevice,
  onRescan,
  onCancel,
}: ScanPhaseProps) {
  const polarDevices = devices.filter(isPolarH10);
  const otherDevices = devices.filter((d) => !isPolarH10(d));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{STRINGS.connectToSensor}</Text>
      {pairedDeviceId && <Text style={styles.subtitle}>{STRINGS.lookingForPaired}</Text>}
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
          <TouchableOpacity
            style={styles.rescanButton}
            activeOpacity={0.7}
            onPress={onRescan}
            accessibilityRole="button"
            accessibilityLabel="Scan again for heart rate monitors"
          >
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
              onPress={() => onSelectDevice(device)}
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
              onPress={() => onSelectDevice(device)}
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
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel scanning"
        activeOpacity={0.7}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
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
