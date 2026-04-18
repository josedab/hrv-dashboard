import { StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

/**
 * Shared style sheet for all SettingsScreen section components.
 * Centralised so each section file can stay under ~150 lines and so
 * visual tweaks remain consistent across sections.
 */
export const settingsStyles = StyleSheet.create({
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
