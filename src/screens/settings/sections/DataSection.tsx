/** Settings: data export (CSV), encrypted backup/restore, and data management. */
import React from 'react';
import { Text, TouchableOpacity, Alert, Share } from 'react-native';
import { getAllSessions } from '../../../database/sessionRepository';
import { sessionsToCSV } from '../../../utils/csv';
import { settingsStyles as s } from '../styles';
import * as DocumentPicker from 'expo-document-picker';

interface Props {
  onCreateBackup: () => void;
  onPickRestoreFile: (fileUri: string) => void;
  onToast: (message: string, type?: 'success' | 'error') => void;
}

/** CSV export + encrypted backup create/restore controls. */
export function DataSection({ onCreateBackup, onPickRestoreFile, onToast }: Props) {
  const exportCSV = async () => {
    try {
      const sessions = await getAllSessions();
      if (sessions.length === 0) {
        Alert.alert('No Data', 'No sessions to export.');
        return;
      }
      const csv = sessionsToCSV(sessions);
      await Share.share({ message: csv, title: 'HRV Sessions Export' });
      onToast(`Exported ${sessions.length} sessions`);
    } catch {
      onToast('Failed to export data', 'error');
    }
  };

  const pickRestoreFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (result.canceled || !result.assets?.[0]) return;
      onPickRestoreFile(result.assets[0].uri);
    } catch {
      Alert.alert('Error', 'Failed to select file.');
    }
  };

  return (
    <>
      <Text style={s.sectionTitle}>Data</Text>
      <TouchableOpacity
        style={s.exportButton}
        onPress={exportCSV}
        accessibilityRole="button"
        accessibilityLabel="Export sessions as CSV"
        activeOpacity={0.7}
      >
        <Text style={s.exportButtonText}>Export as CSV</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.exportButton, { marginTop: 8 }]}
        onPress={onCreateBackup}
        accessibilityRole="button"
        accessibilityLabel="Create encrypted backup"
        activeOpacity={0.7}
      >
        <Text style={s.exportButtonText}>🔒 Create Backup</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.exportButton, { marginTop: 8 }]}
        onPress={pickRestoreFile}
        accessibilityRole="button"
        accessibilityLabel="Restore from backup"
        activeOpacity={0.7}
      >
        <Text style={s.exportButtonText}>📥 Restore Backup</Text>
      </TouchableOpacity>
    </>
  );
}
