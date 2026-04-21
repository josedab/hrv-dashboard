/** CSV import wizard screen — file picker, vendor auto-detection, preview, and commit. */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { COLORS } from '../constants/colors';
import { ImportSource } from '../integrations/import/vendors';
import { planImport, commitImport, ImportPreview } from '../integrations/import/wizard';
import { saveSession, getAllSessions } from '../database/sessionRepository';

const SOURCES: { id: ImportSource; label: string; format: string }[] = [
  { id: 'whoop', label: 'Whoop', format: 'CSV' },
  { id: 'oura', label: 'Oura', format: 'JSON' },
  { id: 'garmin', label: 'Garmin Connect', format: 'CSV' },
  { id: 'elite_hrv', label: 'Elite HRV', format: 'CSV' },
  { id: 'hrv4training', label: 'HRV4Training', format: 'CSV' },
];

type Step = 'select' | 'preview' | 'done';

export function ImportScreen() {
  const [step, setStep] = useState<Step>('select');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [insertedCount, setInsertedCount] = useState(0);

  const onSelectSource = useCallback(async (source: ImportSource) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: source === 'oura' ? 'application/json' : 'text/csv',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setBusy(true);
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri);

      const getExistingIds = async () => {
        const sessions = await getAllSessions();
        return new Set(sessions.map((s) => s.id));
      };

      const importPreview = await planImport(source, content, getExistingIds);
      setPreview(importPreview);
      setStep('preview');
    } catch (err) {
      Alert.alert('Import Error', (err as Error).message ?? 'Failed to read file.');
    } finally {
      setBusy(false);
    }
  }, []);

  const onConfirmImport = useCallback(async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const result = await commitImport(preview, saveSession);
      setInsertedCount(result.inserted);
      setStep('done');
      if (result.failed.length > 0) {
        Alert.alert(
          'Import Complete',
          `${result.inserted} imported, ${result.failed.length} failed.`
        );
      }
    } catch (err) {
      Alert.alert('Import Error', (err as Error).message ?? 'Failed to save sessions.');
    } finally {
      setBusy(false);
    }
  }, [preview]);

  const onReset = useCallback(() => {
    setStep('select');
    setPreview(null);
    setInsertedCount(0);
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Import Data</Text>
      <Text style={styles.subtitle}>
        Import HRV data from another platform to build your baseline faster.
      </Text>

      {busy && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={COLORS.accent} />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}

      {step === 'select' && !busy && (
        <View>
          <Text style={styles.sectionTitle}>Select Source</Text>
          {SOURCES.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.sourceRow}
              onPress={() => onSelectSource(s.id)}
              accessibilityRole="button"
              accessibilityLabel={`Import from ${s.label}`}
            >
              <Text style={styles.sourceName}>{s.label}</Text>
              <Text style={styles.sourceFormat}>{s.format}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {step === 'preview' && preview && !busy && (
        <View>
          <Text style={styles.sectionTitle}>Import Preview</Text>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Source</Text>
            <Text style={styles.statValue}>{preview.source}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total sessions found</Text>
            <Text style={styles.statValue}>{preview.total}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Will import</Text>
            <Text style={[styles.statValue, { color: COLORS.success }]}>{preview.willInsert}</Text>
          </View>
          {preview.collisions > 0 && (
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Already exists (skip)</Text>
              <Text style={[styles.statValue, { color: COLORS.warning ?? '#F59E0B' }]}>
                {preview.collisions}
              </Text>
            </View>
          )}
          {preview.parseErrors.length > 0 && (
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Parse errors</Text>
              <Text style={[styles.statValue, { color: COLORS.danger ?? '#EF4444' }]}>
                {preview.parseErrors.length}
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={onConfirmImport}
              disabled={preview.willInsert === 0}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>
                Import {preview.willInsert} Session{preview.willInsert !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={onReset} accessibilityRole="button">
              <Text style={[styles.buttonText, { color: COLORS.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'done' && (
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>✅</Text>
          <Text style={styles.doneTitle}>Import Complete</Text>
          <Text style={styles.doneSubtitle}>
            {insertedCount} session{insertedCount !== 1 ? 's' : ''} imported successfully.
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={onReset}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Import More</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.textMuted, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    marginBottom: 8,
  },
  sourceName: { fontSize: 16, color: COLORS.text, fontWeight: '500' },
  sourceFormat: { fontSize: 12, color: COLORS.textMuted },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  loadingText: { color: COLORS.textMuted, fontSize: 14 },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border ?? '#334155',
  },
  statLabel: { fontSize: 14, color: COLORS.textMuted },
  statValue: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  actions: { marginTop: 24, gap: 12 },
  button: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  buttonPrimary: { backgroundColor: COLORS.accent },
  buttonText: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  doneContainer: { alignItems: 'center', paddingTop: 48 },
  doneEmoji: { fontSize: 48, marginBottom: 12 },
  doneTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  doneSubtitle: { fontSize: 14, color: COLORS.textMuted, marginBottom: 32 },
});
