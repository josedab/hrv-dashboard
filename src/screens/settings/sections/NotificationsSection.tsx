/** Settings: morning reminder, streak reminder, and weekly digest notification toggles. */
import React from 'react';
import { View, Text, TouchableOpacity, Switch, Alert } from 'react-native';
import { COLORS } from '../../../constants/colors';
import {
  NotificationSettings,
  saveNotificationSettings,
  requestNotificationPermissions,
  cancelAllReminders,
} from '../../../utils/notifications';
import { settingsStyles as s } from '../styles';

const REMINDER_TIME_OPTIONS = [
  { h: 5, m: 30, label: '5:30' },
  { h: 6, m: 0, label: '6:00' },
  { h: 6, m: 30, label: '6:30' },
  { h: 7, m: 0, label: '7:00' },
  { h: 7, m: 30, label: '7:30' },
] as const;

interface Props {
  settings: NotificationSettings;
  onChange: (next: NotificationSettings) => void;
}

/** Morning reminder + streak protection toggles. */
export function NotificationsSection({ settings, onChange }: Props) {
  const toggleMorning = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Permissions Required', 'Enable notifications in Settings to use reminders.');
        return;
      }
    }
    const updated = { ...settings, morningReminderEnabled: enabled };
    onChange(updated);
    await saveNotificationSettings(updated);
  };

  const setReminderTime = async (h: number, m: number) => {
    const updated = { ...settings, morningReminderHour: h, morningReminderMinute: m };
    onChange(updated);
    await saveNotificationSettings(updated);
  };

  const toggleStreak = async (enabled: boolean) => {
    if (enabled && !settings.morningReminderEnabled) {
      const granted = await requestNotificationPermissions();
      if (!granted) return;
    }
    const updated = { ...settings, streakReminderEnabled: enabled };
    onChange(updated);
    await saveNotificationSettings(updated);
    if (!enabled) await cancelAllReminders();
  };

  return (
    <>
      <Text style={s.sectionTitle}>Notifications</Text>
      <View style={s.settingRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.settingLabel}>Morning Reminder</Text>
          <Text style={s.sectionDesc}>
            Daily reminder at {String(settings.morningReminderHour).padStart(2, '0')}:
            {String(settings.morningReminderMinute).padStart(2, '0')}
          </Text>
        </View>
        <Switch
          value={settings.morningReminderEnabled}
          onValueChange={toggleMorning}
          trackColor={{ false: COLORS.surfaceLight, true: COLORS.accent }}
          thumbColor={COLORS.text}
        />
      </View>

      {settings.morningReminderEnabled && (
        <View style={s.optionRow}>
          {REMINDER_TIME_OPTIONS.map(({ h, m, label }) => {
            const selected =
              settings.morningReminderHour === h && settings.morningReminderMinute === m;
            return (
              <TouchableOpacity
                key={label}
                style={[s.optionButton, selected && s.optionButtonSelected]}
                onPress={() => setReminderTime(h, m)}
                activeOpacity={0.7}
              >
                <Text style={[s.optionText, selected && s.optionTextSelected]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={[s.settingRow, { marginTop: 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.settingLabel}>Streak Protection</Text>
          <Text style={s.sectionDesc}>Remind at 10 AM if no reading taken</Text>
        </View>
        <Switch
          value={settings.streakReminderEnabled}
          onValueChange={toggleStreak}
          trackColor={{ false: COLORS.surfaceLight, true: COLORS.accent }}
          thumbColor={COLORS.text}
        />
      </View>
    </>
  );
}
