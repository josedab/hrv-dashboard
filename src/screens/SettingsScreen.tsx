import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants/colors';
import { Settings, DEFAULT_SETTINGS } from '../types';
import { loadSettings } from '../database/settingsRepository';
import { Toast } from '../components/Toast';
import {
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  loadNotificationSettings,
} from '../utils/notifications';
import { createBackup, restoreBackup } from '../utils/backup';
import {
  isHealthSyncAvailable,
  loadHealthSyncSettings,
  HealthSyncSettings,
} from '../utils/healthSync';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STRINGS } from '../constants/strings';
import { PassphraseModal } from '../components/PassphraseModal';

import { BaselineSection } from './settings/sections/BaselineSection';
import { RecordingSection } from './settings/sections/RecordingSection';
import { NotificationsSection } from './settings/sections/NotificationsSection';
import { PairedDeviceSection } from './settings/sections/PairedDeviceSection';
import { HealthSection } from './settings/sections/HealthSection';
import { DataSection } from './settings/sections/DataSection';
import { NavSection } from './settings/sections/NavSection';

type ToastState = { visible: boolean; message: string; type: 'success' | 'error' };
type PassphraseState = { visible: boolean; mode: 'create' | 'restore'; fileUri?: string };

/**
 * Top-level Settings screen. Owns shared state (settings, notification
 * settings, health sync, passphrase modal, toast) and renders each
 * functional area as its own self-contained section component under
 * `./settings/sections/`. Keeping section components small makes them
 * individually previewable and easier to test in isolation.
 */
export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS
  );
  const [healthSync, setHealthSync] = useState<HealthSyncSettings>({
    enabled: false,
    lastSyncTimestamp: null,
    syncedSessionCount: 0,
  });
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'success',
  });
  const [passphraseModal, setPassphraseModal] = useState<PassphraseState>({
    visible: false,
    mode: 'create',
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
  }, []);

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={{ flex: 1 }}>
      <Toast
        message={toast.message}
        visible={toast.visible}
        type={toast.type}
        onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      >
        <Text style={styles.title}>Settings</Text>

        <BaselineSection settings={settings} onChange={setSettings} onToast={showToast} />
        <RecordingSection settings={settings} onChange={setSettings} />
        <NotificationsSection settings={notifSettings} onChange={setNotifSettings} />
        <PairedDeviceSection settings={settings} onChange={setSettings} />
        <HealthSection available={healthAvailable} state={healthSync} onChange={setHealthSync} />
        <DataSection
          onCreateBackup={() => setPassphraseModal({ visible: true, mode: 'create' })}
          onPickRestoreFile={(fileUri) =>
            setPassphraseModal({ visible: true, mode: 'restore', fileUri })
          }
          onToast={showToast}
        />
        <NavSection />
      </ScrollView>

      <PassphraseModal
        visible={passphraseModal.visible}
        title={
          passphraseModal.mode === 'create' ? STRINGS.passphraseCreate : STRINGS.passphraseRestore
        }
        message={
          passphraseModal.mode === 'create'
            ? STRINGS.passphraseCreateMessage
            : STRINGS.passphraseRestoreMessage
        }
        confirmLabel={passphraseModal.mode === 'create' ? 'Create' : 'Restore'}
        minLength={passphraseModal.mode === 'create' ? 4 : 1}
        onCancel={() => setPassphraseModal({ visible: false, mode: 'create' })}
        onConfirm={async (passphrase) => {
          const mode = passphraseModal.mode;
          const fileUri = passphraseModal.fileUri;
          setPassphraseModal({ visible: false, mode: 'create' });
          try {
            if (mode === 'create') {
              await createBackup(passphrase);
              showToast(STRINGS.backupCreated);
            } else if (fileUri) {
              const count = await restoreBackup(fileUri, passphrase);
              showToast(STRINGS.backupRestored.replace('{count}', String(count)));
            }
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Operation failed.', 'error');
          }
        }}
      />
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
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 24,
  },
});
