/** Plugin management screen — browse marketplace, install/uninstall plugins, view metrics. */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { COLORS } from '../constants/colors';
import {
  loadInstalledPlugins,
  uninstallPlugin,
  installPluginFromJson,
  InstalledPlugin,
} from '../plugins/marketplace';
import { SqlitePluginStorage } from '../plugins/sqliteStorage';
import { getErrorMessage } from '../utils/errors';

const storage = new SqlitePluginStorage();

const PLUGIN_INSTALL_PLACEHOLDER = `{
  "manifest": {
    "id": "rmssd-stddev",
    "name": "rMSSD Std Dev",
    "version": "0.1.0",
    "permissions": ["read:session"]
  },
  "source": "function compute(s){return {value:0}}"
}`;

export function PluginsScreen() {
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [failures, setFailures] = useState<{ id: string; reason: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInstall, setShowInstall] = useState(false);
  const [installJson, setInstallJson] = useState('');
  const [installing, setInstalling] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await storage.list();
      setPlugins(list);
      const result = await loadInstalledPlugins(storage);
      setFailures(result.failures);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onRemove = useCallback(
    (id: string) => {
      Alert.alert('Remove plugin', `Remove "${id}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await uninstallPlugin(id, storage);
            await refresh();
          },
        },
      ]);
    },
    [refresh]
  );

  const onInstall = useCallback(async () => {
    if (installing) return;
    setInstalling(true);
    try {
      const installed = await installPluginFromJson(installJson, storage);
      setInstallJson('');
      setShowInstall(false);
      await refresh();
      Alert.alert('Installed', `"${installed.manifest.name}" v${installed.version} added.`);
    } catch (err) {
      Alert.alert('Install failed', getErrorMessage(err));
    } finally {
      setInstalling(false);
    }
  }, [installJson, installing, refresh]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Plugins</Text>
      <Text style={styles.body}>
        Plugins compute custom HRV metrics from your sessions. They run in a sandboxed JavaScript
        environment with read-only access to the session being processed.
      </Text>

      <TouchableOpacity
        style={styles.installToggle}
        onPress={() => setShowInstall((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={showInstall ? 'Hide install form' : 'Install a plugin'}
        accessibilityState={{ expanded: showInstall }}
      >
        <Text style={styles.installToggleText}>
          {showInstall ? '▼ Cancel install' : '＋ Install from JSON'}
        </Text>
      </TouchableOpacity>

      {showInstall && (
        <View style={styles.installBox}>
          <Text style={styles.installHint}>
            Paste a plugin entry: an object with `manifest`, `source`, and (optionally)
            `fingerprint`. The fingerprint is auto-computed from the source if omitted.
          </Text>
          <TextInput
            style={styles.installInput}
            multiline
            placeholder={PLUGIN_INSTALL_PLACEHOLDER}
            placeholderTextColor={COLORS.textMuted}
            value={installJson}
            onChangeText={setInstallJson}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.installButton, installing && { opacity: 0.5 }]}
            onPress={onInstall}
            disabled={installing}
            accessibilityRole="button"
            accessibilityLabel="Install plugin from JSON"
          >
            {installing ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.installButtonText}>Install</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 24 }} />
      ) : plugins.length === 0 ? (
        <Text style={styles.empty}>No plugins installed yet.</Text>
      ) : (
        plugins.map((p) => (
          <View key={p.id} style={styles.card}>
            <Text style={styles.cardTitle}>{p.manifest.name}</Text>
            <Text style={styles.cardSub}>
              v{p.manifest.version} · {p.manifest.author ?? 'unknown'}
            </Text>
            {p.manifest.description && (
              <Text style={styles.cardDesc}>{p.manifest.description}</Text>
            )}
            <View style={styles.cardFooter}>
              <Text style={styles.cardMeta}>
                Installed {new Date(p.installedAt).toLocaleDateString()}
              </Text>
              <TouchableOpacity onPress={() => onRemove(p.id)}>
                <Text style={styles.removeBtn}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {failures.length > 0 && (
        <View style={styles.failures}>
          <Text style={styles.failuresTitle}>Failed to load:</Text>
          {failures.map((f) => (
            <Text key={f.id} style={styles.failureLine}>
              • {f.id}: {f.reason}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  body: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 20 },
  empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 32 },
  installToggle: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  installToggleText: { color: COLORS.accent, fontWeight: '600', fontSize: 14 },
  installBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  installHint: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  installInput: {
    minHeight: 140,
    backgroundColor: COLORS.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 8,
    color: COLORS.text,
    fontSize: 12,
    fontFamily: 'Courier',
    textAlignVertical: 'top',
  },
  installButton: {
    marginTop: 10,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  installButtonText: { color: COLORS.text, fontWeight: '700' },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  cardSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  cardDesc: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  cardMeta: { color: COLORS.textMuted, fontSize: 12 },
  removeBtn: { color: COLORS.danger, fontSize: 13, fontWeight: '600' },
  failures: {
    marginTop: 24,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  failuresTitle: { color: COLORS.danger, fontWeight: '700', marginBottom: 6 },
  failureLine: { color: COLORS.textSecondary, fontSize: 12 },
});
