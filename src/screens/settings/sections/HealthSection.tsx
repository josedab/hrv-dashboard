import React from 'react';
import { View, Text, Switch, Alert, Platform } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { getAllSessions } from '../../../database/sessionRepository';
import {
  HealthSyncSettings,
  setHealthSyncEnabled,
  requestHealthPermissions,
  syncAllPendingSessions,
  loadHealthSyncSettings,
} from '../../../utils/healthSync';
import { settingsStyles as s } from '../styles';

interface Props {
  available: boolean;
  state: HealthSyncSettings;
  onChange: (next: HealthSyncSettings) => void;
}

/**
 * Apple Health (iOS) / Health Connect (Android) sync toggle.
 * Hidden entirely when no platform integration is available.
 */
export function HealthSection({ available, state, onChange }: Props) {
  if (!available) return null;

  const toggle = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestHealthPermissions();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          Platform.OS === 'ios'
            ? 'Please grant Health access in Settings > Privacy > Health.'
            : 'Please grant Health Connect access when prompted.'
        );
        return;
      }
    }
    await setHealthSyncEnabled(enabled);
    onChange({ ...state, enabled });

    if (enabled) {
      const sessions = await getAllSessions();
      const synced = await syncAllPendingSessions(sessions);
      if (synced > 0) {
        Alert.alert('Synced', `${synced} sessions synced to Health.`);
        const refreshed = await loadHealthSyncSettings();
        onChange(refreshed);
      }
    }
  };

  return (
    <>
      <Text style={s.sectionTitle}>Health Integration</Text>
      <View style={s.settingRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.settingLabel}>
            {Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect'}
          </Text>
          <Text style={s.sectionDesc}>
            {state.enabled
              ? `${state.syncedSessionCount} sessions synced`
              : 'Sync HRV data to your health platform'}
          </Text>
        </View>
        <Switch
          value={state.enabled}
          onValueChange={toggle}
          trackColor={{ false: COLORS.surfaceLight, true: COLORS.accent }}
          thumbColor={COLORS.text}
        />
      </View>
    </>
  );
}
