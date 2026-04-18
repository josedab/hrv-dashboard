import React from 'react';
import { View, Text, Switch } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { Settings } from '../../../types';
import { saveSetting } from '../../../database/settingsRepository';
import { STRINGS } from '../../../constants/strings';
import { settingsStyles as s } from '../styles';

interface Props {
  settings: Settings;
  onChange: (next: Settings) => void;
}

/** Recording-related preferences (currently: breathing exercise toggle). */
export function RecordingSection({ settings, onChange }: Props) {
  const toggleBreathing = async (enabled: boolean) => {
    onChange({ ...settings, breathingExerciseEnabled: enabled });
    await saveSetting('breathingExerciseEnabled', enabled ? 'true' : 'false');
  };

  return (
    <>
      <Text style={s.sectionTitle}>{STRINGS.recording}</Text>
      <View style={s.settingRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.settingLabel}>{STRINGS.breathingExercise}</Text>
          <Text style={s.sectionDesc}>{STRINGS.breathingExerciseDesc}</Text>
        </View>
        <Switch
          value={settings.breathingExerciseEnabled}
          onValueChange={toggleBreathing}
          trackColor={{ false: COLORS.surfaceLight, true: COLORS.accent }}
          thumbColor={COLORS.text}
          accessibilityLabel={STRINGS.breathingExercise}
        />
      </View>
    </>
  );
}
