/** Settings: paired BLE device display with forget/re-pair controls. */
import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Settings } from '../../../types';
import { clearPairedDevice } from '../../../database/settingsRepository';
import { settingsStyles as s } from '../styles';

interface Props {
  settings: Settings;
  onChange: (next: Settings) => void;
}

/** Shows the paired BLE heart rate monitor with an option to forget it. */
export function PairedDeviceSection({ settings, onChange }: Props) {
  const forgetDevice = () => {
    Alert.alert('Forget Device', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget',
        style: 'destructive',
        onPress: async () => {
          await clearPairedDevice();
          onChange({ ...settings, pairedDeviceId: null, pairedDeviceName: null });
        },
      },
    ]);
  };

  return (
    <>
      <Text style={s.sectionTitle}>Paired Device</Text>
      {settings.pairedDeviceName ? (
        <View style={s.deviceInfo}>
          <Text style={s.deviceName}>{settings.pairedDeviceName}</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={forgetDevice}
            accessibilityRole="button"
            accessibilityLabel="Forget paired device"
          >
            <Text style={s.forgetText}>Forget</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={s.noDevice}>No device paired. Connect during your next reading.</Text>
      )}
    </>
  );
}
