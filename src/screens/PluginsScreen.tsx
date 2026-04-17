import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../constants/colors';
import {
  loadInstalledPlugins,
  uninstallPlugin,
  InstalledPlugin,
} from '../plugins/marketplace';
import { SqlitePluginStorage } from '../plugins/sqliteStorage';

const storage = new SqlitePluginStorage();

export function PluginsScreen() {
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [failures, setFailures] = useState<{ id: string; reason: string }[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Plugins</Text>
      <Text style={styles.body}>
        Plugins compute custom HRV metrics from your sessions. They run in a sandboxed JavaScript
        environment with read-only access to the session being processed.
      </Text>

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
