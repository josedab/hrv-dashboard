import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet, Share } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS } from '../constants/colors';
import { Settings, DEFAULT_SETTINGS } from '../types';
import { loadSettings, saveSetting, clearPairedDevice, validateThresholds } from '../database/settingsRepository';
import { getAllSessions } from '../database/sessionRepository';
import { sessionsToCSV } from '../utils/csv';
import { RootStackParamList } from '../navigation/AppNavigator';

const BASELINE_WINDOW_OPTIONS = [5, 7, 10, 14];

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const load = useCallback(async () => {
    const s = await loadSettings();
    setSettings(s);
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
    } catch (error) {
      Alert.alert('Error', 'Failed to export data.');
    }
  };

  return (
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
          >
            <Text style={[styles.optionText, settings.baselineWindowDays === days && styles.optionTextSelected]}>
              {days}d
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Advanced Thresholds */}
      <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvanced(!showAdvanced)}>
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

          <TouchableOpacity style={[styles.exportButton, { marginTop: 16 }]} onPress={resetThresholds}>
            <Text style={styles.exportButtonText}>Reset to Defaults</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Paired Device */}
      <Text style={styles.sectionTitle}>Paired Device</Text>
      {settings.pairedDeviceName ? (
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>{settings.pairedDeviceName}</Text>
          <TouchableOpacity onPress={forgetDevice}>
            <Text style={styles.forgetText}>Forget</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.noDevice}>No device paired. Connect during your next reading.</Text>
      )}

      {/* Export */}
      <Text style={styles.sectionTitle}>Data</Text>
      <TouchableOpacity
        style={styles.exportButton}
        onPress={exportCSV}
        accessibilityRole="button"
        accessibilityLabel="Export sessions as CSV"
      >
        <Text style={styles.exportButtonText}>Export as CSV</Text>
      </TouchableOpacity>

      {/* About */}
      <View style={styles.about}>
        <Text style={styles.aboutText}>HRV Readiness Dashboard v1.0.0</Text>
        <Text style={styles.aboutText}>Uses Polar H10 via Heart Rate Service</Text>
      </View>

      <TouchableOpacity
        style={styles.exportButton}
        onPress={() => navigation.navigate('PrivacyPolicy')}
      >
        <Text style={styles.exportButtonText}>Privacy Policy</Text>
      </TouchableOpacity>
    </ScrollView>
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
});
