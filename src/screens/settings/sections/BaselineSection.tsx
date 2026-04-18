import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Settings, DEFAULT_SETTINGS, VerdictMode } from '../../../types';
import { saveSetting, validateThresholds } from '../../../database/settingsRepository';
import { settingsStyles as s } from '../styles';

const BASELINE_WINDOW_OPTIONS = [5, 7, 10, 14] as const;
const GO_HARD_PCT_OPTIONS = [90, 95, 100] as const;
const MODERATE_PCT_OPTIONS = [70, 75, 80, 85] as const;

interface Props {
  settings: Settings;
  onChange: (next: Settings) => void;
  onToast: (message: string, type?: 'success' | 'error') => void;
}

/**
 * Baseline window length, verdict mode (fixed vs adaptive), and (in the
 * collapsible advanced subsection) the per-cutoff ratio thresholds used
 * by the fixed mode.
 */
export function BaselineSection({ settings, onChange, onToast }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateBaselineWindow = async (days: number) => {
    await saveSetting('baselineWindowDays', String(days));
    onChange({ ...settings, baselineWindowDays: days });
    onToast('Settings updated');
  };

  const updateVerdictMode = async (mode: VerdictMode) => {
    await saveSetting('verdictMode', mode);
    onChange({ ...settings, verdictMode: mode });
    onToast('Settings updated');
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
    onChange({ ...settings, [key]: value });
    onToast('Settings updated');
  };

  const resetThresholds = async () => {
    await saveSetting('goHardThreshold', String(DEFAULT_SETTINGS.goHardThreshold));
    await saveSetting('moderateThreshold', String(DEFAULT_SETTINGS.moderateThreshold));
    onChange({
      ...settings,
      goHardThreshold: DEFAULT_SETTINGS.goHardThreshold,
      moderateThreshold: DEFAULT_SETTINGS.moderateThreshold,
    });
    onToast('Settings updated');
  };

  return (
    <>
      <Text style={s.sectionTitle}>Baseline Window</Text>
      <Text style={s.sectionDesc}>Number of days used to compute your rolling baseline.</Text>
      <View style={s.optionRow}>
        {BASELINE_WINDOW_OPTIONS.map((days) => {
          const selected = settings.baselineWindowDays === days;
          return (
            <TouchableOpacity
              key={days}
              style={[s.optionButton, selected && s.optionButtonSelected]}
              onPress={() => updateBaselineWindow(days)}
              accessibilityRole="button"
              accessibilityLabel={`Baseline window: ${days} days`}
              accessibilityState={{ selected }}
              activeOpacity={0.7}
            >
              <Text style={[s.optionText, selected && s.optionTextSelected]}>{days}d</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={s.sectionTitle}>Verdict Mode</Text>
      <Text style={s.sectionDesc}>
        {settings.verdictMode === 'adaptive'
          ? 'Personal percentile cutoffs from your own history (≥30 days needed; falls back to fixed during cold start).'
          : 'Fixed ratio cutoffs that are identical for every user.'}
      </Text>
      <View style={s.optionRow}>
        {(['fixed', 'adaptive'] as const).map((mode) => {
          const selected = settings.verdictMode === mode;
          return (
            <TouchableOpacity
              key={mode}
              style={[s.optionButton, selected && s.optionButtonSelected]}
              onPress={() => updateVerdictMode(mode)}
              accessibilityRole="button"
              accessibilityLabel={`Verdict mode: ${mode}`}
              accessibilityState={{ selected }}
              activeOpacity={0.7}
            >
              <Text style={[s.optionText, selected && s.optionTextSelected]}>
                {mode === 'fixed' ? 'Fixed' : 'Adaptive'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={s.advancedToggle}
        activeOpacity={0.7}
        onPress={() => setShowAdvanced(!showAdvanced)}
        accessibilityRole="button"
        accessibilityLabel={showAdvanced ? 'Hide advanced thresholds' : 'Show advanced thresholds'}
        accessibilityState={{ expanded: showAdvanced }}
      >
        <Text style={s.advancedToggleText}>
          {showAdvanced ? '▼' : '▶'} Advanced Thresholds (Fixed mode)
        </Text>
      </TouchableOpacity>

      {showAdvanced && (
        <View style={s.advancedSection}>
          <Text style={s.thresholdLabel}>Go Hard threshold</Text>
          <Text style={s.sectionDesc}>rMSSD at or above this % of baseline → Go Hard</Text>
          <View style={s.optionRow}>
            {GO_HARD_PCT_OPTIONS.map((pct) => {
              const ratio = pct / 100;
              const isDisabled = ratio <= settings.moderateThreshold;
              const selected = settings.goHardThreshold === ratio;
              return (
                <TouchableOpacity
                  key={`go-${pct}`}
                  style={[
                    s.optionButton,
                    selected && s.optionButtonSelected,
                    isDisabled && s.optionButtonDisabled,
                  ]}
                  onPress={() => updateThreshold('goHardThreshold', ratio)}
                  disabled={isDisabled}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      s.optionText,
                      selected && s.optionTextSelected,
                      isDisabled && s.optionTextDisabled,
                    ]}
                  >
                    {pct}%
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[s.thresholdLabel, { marginTop: 16 }]}>Moderate threshold</Text>
          <Text style={s.sectionDesc}>rMSSD at or above this % of baseline → Moderate</Text>
          <View style={s.optionRow}>
            {MODERATE_PCT_OPTIONS.map((pct) => {
              const ratio = pct / 100;
              const isDisabled = ratio >= settings.goHardThreshold;
              const selected = settings.moderateThreshold === ratio;
              return (
                <TouchableOpacity
                  key={`mod-${pct}`}
                  style={[
                    s.optionButton,
                    selected && s.optionButtonSelected,
                    isDisabled && s.optionButtonDisabled,
                  ]}
                  onPress={() => updateThreshold('moderateThreshold', ratio)}
                  disabled={isDisabled}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      s.optionText,
                      selected && s.optionTextSelected,
                      isDisabled && s.optionTextDisabled,
                    ]}
                  >
                    {pct}%
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[s.exportButton, { marginTop: 16 }]}
            activeOpacity={0.7}
            onPress={resetThresholds}
            accessibilityRole="button"
            accessibilityLabel="Reset thresholds to default values"
          >
            <Text style={s.exportButtonText}>Reset to Defaults</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}
