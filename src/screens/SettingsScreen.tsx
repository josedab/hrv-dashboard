import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet, Share, Switch, Platform } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS } from '../constants/colors';
import { Settings, DEFAULT_SETTINGS } from '../types';
import { loadSettings, saveSetting, clearPairedDevice, validateThresholds } from '../database/settingsRepository';
import { getAllSessions } from '../database/sessionRepository';
import { sessionsToCSV } from '../utils/csv';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Toast } from '../components/Toast';
import {
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  loadNotificationSettings,
  saveNotificationSettings,
  requestNotificationPermissions,
  cancelAllReminders,
} from '../utils/notifications';
import { createBackup, restoreBackup } from '../utils/backup';
import {
  isHealthSyncAvailable,
  loadHealthSyncSettings,
  setHealthSyncEnabled,
  requestHealthPermissions,
  syncAllPendingSessions,
  HealthSyncSettings,
} from '../utils/healthSync';
import * as DocumentPicker from 'expo-document-picker';

const BASELINE_WINDOW_OPTIONS = [5, 7, 10, 14];

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [healthSync, setHealthSync] = useState<HealthSyncSettings>({ enabled: false, lastSyncTimestamp: null, syncedSessionCount: 0 });
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
  };

  const load = useCallback(async () => {
    const [s, ns, hs] = await Promise.all([
      loadSettings(),
      loadNotificationSettings(),
      loadHealthSyncSettings(),
    ]);
    setSettings(s);
    setNotifSettings(ns);
    setHealthSync(hs);
    setHealthAvailable(isHealthSyncAvailable());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const updateBaselineWindow = async (days: number) => {
    await saveSetting('baselineWindowDays', String(days));
    setSettings((prev) => ({ ...prev, baselineWindowDays: days }));
  };

  const updateThreshold = async (key: 'goHardThreshold' | 'moderateThreshold', value: number) => {
    const newGoHard = key === 'goHardThreshold' ? value : settings.goHardThreshold;
    const newModerate = key === 'moderateThreshold' ? value : settings.moderateThreshold;
    const error = validateThresholds(newGoHard, newModerate);
    if (error) {
      Alert.alert('Invalid Threshold', error);
      return;
    }
    await saveSetting(key, String(value));
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const resetThresholds = async () => {
    await saveSetting('goHardThreshold', String(DEFAULT_SETTINGS.goHardThreshold));
    await saveSetting('moderateThreshold', String(DEFAULT_SETTINGS.moderateThreshold));
    setSettings((prev) => ({
      ...prev,
      goHardThreshold: DEFAULT_SETTINGS.goHardThreshold,
      moderateThreshold: DEFAULT_SETTINGS.moderateThreshold,
    }));
  };

  const forgetDevice = async () => {
    Alert.alert('Forget Device', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget',
        style: 'destructive',
        onPress: async () => {
          await clearPairedDevice();
          setSettings((prev) => ({ ...prev, pairedDeviceId: null, pairedDeviceName: null }));
        },
      },
    ]);
  };

  const exportCSV = async () => {
    try {
      const sessions = await getAllSessions();
      if (sessions.length === 0) {
        Alert.alert('No Data', 'No sessions to export.');
        return;
      }
      const csv = sessionsToCSV(sessions);
      await Share.share({
        message: csv,
        title: 'HRV Sessions Export',
      });
      showToast(`Exported ${sessions.length} sessions`);
    } catch (error) {
      showToast('Failed to export data', 'error');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Toast
        message={toast.message}
        visible={toast.visible}
        type={toast.type}
        onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {/* Baseline Window */}
      <Text style={styles.sectionTitle}>Baseline Window</Text>
      <Text style={styles.sectionDesc}>Number of days used to compute your rolling baseline.</Text>
      <View style={styles.optionRow}>
        {BASELINE_WINDOW_OPTIONS.map((days) => (
          <TouchableOpacity
            key={days}
            style={[styles.optionButton, settings.baselineWindowDays === days && styles.optionButtonSelected]}
            onPress={() => updateBaselineWindow(days)}
            accessibilityRole="button"
            accessibilityLabel={`Baseline window: ${days} days`}
            accessibilityState={{ selected: settings.baselineWindowDays === days }}
             activeOpacity={0.7}
          >
            <Text style={[styles.optionText, settings.baselineWindowDays === days && styles.optionTextSelected]}>
              {days}d
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Advanced Thresholds */}
      <TouchableOpacity style={styles.advancedToggle} activeOpacity={0.7} onPress={() => setShowAdvanced(!showAdvanced)} accessibilityRole="button" accessibilityLabel={showAdvanced ? 'Hide advanced thresholds' : 'Show advanced thresholds'} accessibilityState={{ expanded: showAdvanced }}>
        <Text style={styles.advancedToggleText}>
          {showAdvanced ? '▼' : '▶'} Advanced Thresholds
        </Text>
      </TouchableOpacity>

      {showAdvanced && (
        <View style={styles.advancedSection}>
          <Text style={styles.thresholdLabel}>Go Hard threshold</Text>
          <Text style={styles.sectionDesc}>rMSSD at or above this % of baseline → Go Hard</Text>
          <View style={styles.optionRow}>
            {[90, 95, 100].map((pct) => {
              const isDisabled = pct / 100 <= settings.moderateThreshold;
              return (
                <TouchableOpacity
                  key={`go-${pct}`}
                  style={[
                    styles.optionButton,
                    settings.goHardThreshold === pct / 100 && styles.optionButtonSelected,
                    isDisabled && styles.optionButtonDisabled,
                  ]}
                  onPress={() => updateThreshold('goHardThreshold', pct / 100)}
                  disabled={isDisabled}
                 activeOpacity={0.7}
                >
                  <Text style={[
                    styles.optionText,
                    settings.goHardThreshold === pct / 100 && styles.optionTextSelected,
                    isDisabled && styles.optionTextDisabled,
                  ]}>
                    {pct}%
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.thresholdLabel, { marginTop: 16 }]}>Moderate threshold</Text>
          <Text style={styles.sectionDesc}>rMSSD at or above this % of baseline → Moderate</Text>
          <View style={styles.optionRow}>
            {[70, 75, 80, 85].map((pct) => {
              const isDisabled = pct / 100 >= settings.goHardThreshold;
              return (
                <TouchableOpacity
                  key={`mod-${pct}`}
                  style={[
                    styles.optionButton,
                    settings.moderateThreshold === pct / 100 && styles.optionButtonSelected,
                    isDisabled && styles.optionButtonDisabled,
                  ]}
                  onPress={() => updateThreshold('moderateThreshold', pct / 100)}
                  disabled={isDisabled}
                 activeOpacity={0.7}
                >
                  <Text style={[
                    styles.optionText,
                    settings.moderateThreshold === pct / 100 && styles.optionTextSelected,
                    isDisabled && styles.optionTextDisabled,
                  ]}>
                    {pct}%
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={[styles.exportButton, { marginTop: 16 }]} activeOpacity={0.7} onPress={resetThresholds} accessibilityRole="button" accessibilityLabel="Reset thresholds to default values">
            <Text style={styles.exportButtonText}>Reset to Defaults</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notifications */}
      <Text style={styles.sectionTitle}>Notifications</Text>
      <View style={styles.settingRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.settingLabel}>Morning Reminder</Text>
          <Text style={styles.sectionDesc}>
            Daily reminder at {String(notifSettings.morningReminderHour).padStart(2, '0')}:{String(notifSettings.morningReminderMinute).padStart(2, '0')}
          </Text>
        </View>
        <Switch
          value={notifSettings.morningReminderEnabled}
          onValueChange={async (enabled) => {
            if (enabled) {
              const granted = await requestNotificationPermissions();
              if (!granted) {
                Alert.alert('Permissions Required', 'Enable notifications in Settings to use reminders.');
                return;
              }
            }
            const updated = { ...notifSettings, morningReminderEnabled: enabled };
            setNotifSettings(updated);
            await saveNotificationSettings(updated);
          }}
          trackColor={{ false: COLORS.surfaceLight, true: COLORS.accent }}
          thumbColor={COLORS.text}
        />
      </View>

      {notifSettings.morningReminderEnabled && (
        <View style={styles.optionRow}>
          {[
            { h: 5, m: 30, label: '5:30' },
            { h: 6, m: 0, label: '6:00' },
            { h: 6, m: 30, label: '6:30' },
            { h: 7, m: 0, label: '7:00' },
            { h: 7, m: 30, label: '7:30' },
          ].map(({ h, m, label }) => (
            <TouchableOpacity
              key={label}
              style={[
                styles.optionButton,
                notifSettings.morningReminderHour === h && notifSettings.morningReminderMinute === m && styles.optionButtonSelected,
              ]}
              onPress={async () => {
                const updated = { ...notifSettings, morningReminderHour: h, morningReminderMinute: m };
                setNotifSettings(updated);
                await saveNotificationSettings(updated);
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.optionText,
                notifSettings.morningReminderHour === h && notifSettings.morningReminderMinute === m && styles.optionTextSelected,
              ]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={[styles.settingRow, { marginTop: 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.settingLabel}>Streak Protection</Text>
          <Text style={styles.sectionDesc}>Remind at 10 AM if no reading taken</Text>
        </View>
        <Switch
          value={notifSettings.streakReminderEnabled}
          onValueChange={async (enabled) => {
            if (enabled && !notifSettings.morningReminderEnabled) {
              const granted = await requestNotificationPermissions();
              if (!granted) return;
            }
            const updated = { ...notifSettings, streakReminderEnabled: enabled };
            setNotifSettings(updated);
            await saveNotificationSettings(updated);
            if (!enabled) await cancelAllReminders();
          }}
          trackColor={{ false: COLORS.surfaceLight, true: COLORS.accent }}
          thumbColor={COLORS.text}
        />
      </View>

      {/* Paired Device */}
      <Text style={styles.sectionTitle}>Paired Device</Text>
      {settings.pairedDeviceName ? (
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>{settings.pairedDeviceName}</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={forgetDevice} accessibilityRole="button" accessibilityLabel="Forget paired device">
            <Text style={styles.forgetText}>Forget</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.noDevice}>No device paired. Connect during your next reading.</Text>
      )}

      {/* Health Integration */}
      {healthAvailable && (
        <>
          <Text style={styles.sectionTitle}>Health Integration</Text>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>
                {Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect'}
              </Text>
              <Text style={styles.sectionDesc}>
                {healthSync.enabled
                  ? `${healthSync.syncedSessionCount} sessions synced`
                  : 'Sync HRV data to your health platform'}
              </Text>
            </View>
            <Switch
              value={healthSync.enabled}
              onValueChange={async (enabled) => {
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
                setHealthSync((prev) => ({ ...prev, enabled }));

                if (enabled) {
                  const sessions = await getAllSessions();
                  const synced = await syncAllPendingSessions(sessions);
                  if (synced > 0) {
                    Alert.alert('Synced', `${synced} sessions synced to Health.`);
                    const hs = await loadHealthSyncSettings();
                    setHealthSync(hs);
                  }
                }
              }}
              trackColor={{ false: COLORS.surfaceLight, true: COLORS.accent }}
              thumbColor={COLORS.text}
            />
          </View>
        </>
      )}

      {/* Data */}
      <Text style={styles.sectionTitle}>Data</Text>
      <TouchableOpacity
        style={styles.exportButton}
        onPress={exportCSV}
        accessibilityRole="button"
        accessibilityLabel="Export sessions as CSV"
        activeOpacity={0.7}
      >
        <Text style={styles.exportButtonText}>Export as CSV</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.exportButton, { marginTop: 8 }]}
        onPress={() => {
          Alert.prompt(
            'Create Backup',
            'Enter a passphrase to encrypt your backup:',
            async (passphrase) => {
              if (!passphrase || passphrase.length < 4) {
                Alert.alert('Error', 'Passphrase must be at least 4 characters.');
                return;
              }
              try {
                await createBackup(passphrase);
              } catch {
                Alert.alert('Error', 'Failed to create backup.');
              }
            },
            'secure-text'
          );
        }}
        accessibilityRole="button"
        accessibilityLabel="Create encrypted backup"
        activeOpacity={0.7}
      >
        <Text style={styles.exportButtonText}>🔒 Create Backup</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.exportButton, { marginTop: 8 }]}
        onPress={async () => {
          try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
            if (result.canceled || !result.assets?.[0]) return;
            Alert.prompt(
              'Restore Backup',
              'Enter the passphrase used when creating this backup:',
              async (passphrase) => {
                if (!passphrase) return;
                try {
                  const count = await restoreBackup(result.assets[0].uri, passphrase);
                  Alert.alert('Success', `Restored ${count} new sessions.`);
                } catch (err) {
                  Alert.alert('Error', err instanceof Error ? err.message : 'Restore failed.');
                }
              },
              'secure-text'
            );
          } catch {
            Alert.alert('Error', 'Failed to select file.');
          }
        }}
        accessibilityRole="button"
        accessibilityLabel="Restore from backup"
        activeOpacity={0.7}
      >
        <Text style={styles.exportButtonText}>📥 Restore Backup</Text>
      </TouchableOpacity>

      {/* About */}
      <View style={styles.about}>
        <Text style={styles.aboutText}>HRV Readiness Dashboard v1.0.0</Text>
        <Text style={styles.aboutText}>Uses Polar H10 via Heart Rate Service</Text>
      </View>

      <TouchableOpacity
        style={styles.exportButton}
        onPress={() => navigation.navigate('PrivacyPolicy')}
        activeOpacity={0.7}
      >
        <Text style={styles.exportButtonText}>Privacy Policy</Text>
      </TouchableOpacity>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 24,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  optionButtonSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  optionButtonDisabled: {
    opacity: 0.35,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  optionTextSelected: {
    color: COLORS.text,
  },
  optionTextDisabled: {
    color: COLORS.textMuted,
  },
  advancedToggle: {
    marginTop: 20,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  advancedToggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  advancedSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  thresholdLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  deviceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  deviceName: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  forgetText: {
    fontSize: 14,
    color: COLORS.danger,
    fontWeight: '600',
  },
  noDevice: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 8,
  },
  exportButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.accent,
  },
  about: {
    marginTop: 40,
    alignItems: 'center',
    gap: 4,
  },
  aboutText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
});
