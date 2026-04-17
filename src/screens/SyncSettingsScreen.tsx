import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { COLORS } from '../constants/colors';
import { runSync, SyncResult } from '../sync';
import { InMemorySyncProvider } from '../sync/inMemoryProvider';
import { SupabaseSyncProvider } from '../sync/cloudProviders';
import { getAllSessions } from '../database/sessionRepository';
import { Session } from '../types';
import { getDatabase } from '../database/database';

type Provider = 'none' | 'in-memory' | 'supabase';

const STORAGE_KEYS = {
  provider: 'sync_provider',
  passphrase: 'sync_passphrase',
  supabaseUrl: 'sync_supabase_url',
  supabaseAnon: 'sync_supabase_anon',
  supabaseToken: 'sync_supabase_token',
} as const;

async function readSetting(key: string): Promise<string> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = ?`,
    key
  );
  return row?.value ?? '';
}

async function writeSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, key, value);
}

async function upsertSession(s: Session): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO sessions (
      id, timestamp, durationSeconds, rrIntervals, rmssd, sdnn, meanHr, pnn50,
      artifactRate, verdict, perceivedReadiness, trainingType, notes,
      sleepHours, sleepQuality, stressLevel, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    s.id,
    s.timestamp,
    s.durationSeconds,
    JSON.stringify(s.rrIntervals),
    s.rmssd,
    s.sdnn,
    s.meanHr,
    s.pnn50,
    s.artifactRate,
    s.verdict,
    s.perceivedReadiness,
    s.trainingType,
    s.notes,
    s.sleepHours,
    s.sleepQuality,
    s.stressLevel,
    s.source
  );
}

export function SyncSettingsScreen() {
  const [provider, setProvider] = useState<Provider>('none');
  const [passphrase, setPassphrase] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnon, setSupabaseAnon] = useState('');
  const [supabaseToken, setSupabaseToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    (async () => {
      setProvider(((await readSetting(STORAGE_KEYS.provider)) as Provider) || 'none');
      setPassphrase(await readSetting(STORAGE_KEYS.passphrase));
      setSupabaseUrl(await readSetting(STORAGE_KEYS.supabaseUrl));
      setSupabaseAnon(await readSetting(STORAGE_KEYS.supabaseAnon));
      setSupabaseToken(await readSetting(STORAGE_KEYS.supabaseToken));
    })();
  }, []);

  const persist = useCallback(async () => {
    await writeSetting(STORAGE_KEYS.provider, provider);
    await writeSetting(STORAGE_KEYS.passphrase, passphrase);
    await writeSetting(STORAGE_KEYS.supabaseUrl, supabaseUrl);
    await writeSetting(STORAGE_KEYS.supabaseAnon, supabaseAnon);
    await writeSetting(STORAGE_KEYS.supabaseToken, supabaseToken);
  }, [provider, passphrase, supabaseUrl, supabaseAnon, supabaseToken]);

  const onSync = useCallback(async () => {
    if (provider === 'none') {
      Alert.alert('Pick a provider', 'Choose a provider to sync to.');
      return;
    }
    if (passphrase.length < 8) {
      Alert.alert('Passphrase too short', 'Use at least 8 characters.');
      return;
    }
    setBusy(true);
    setLastResult(null);
    try {
      await persist();
      const syncProvider =
        provider === 'in-memory'
          ? new InMemorySyncProvider()
          : new SupabaseSyncProvider({
              url: supabaseUrl,
              anonKey: supabaseAnon,
              accessToken: supabaseToken,
            });
      const result = await runSync({
        passphrase,
        provider: syncProvider,
        loadLocal: async () => {
          const sessions = await getAllSessions();
          return sessions.map((s) => ({ session: s, updatedAt: s.timestamp }));
        },
        upsertLocal: upsertSession,
      });
      setLastResult(result);
    } catch (err) {
      Alert.alert('Sync failed', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [provider, passphrase, supabaseUrl, supabaseAnon, supabaseToken, persist]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>End-to-end encrypted sync</Text>
      <Text style={styles.body}>
        Sessions are encrypted on this device before being uploaded. The provider only ever sees
        opaque ciphertext. Lose the passphrase, lose the data — keep a backup.
      </Text>

      <Text style={styles.label}>Provider</Text>
      <View style={styles.row}>
        {(['none', 'in-memory', 'supabase'] as Provider[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.chip, provider === p && styles.chipSelected]}
            onPress={() => setProvider(p)}
          >
            <Text style={[styles.chipText, provider === p && styles.chipTextSelected]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Passphrase (min 8 chars)</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        value={passphrase}
        onChangeText={setPassphrase}
        placeholder="something only you know"
        placeholderTextColor={COLORS.textMuted}
      />

      {provider === 'supabase' && (
        <>
          <Text style={styles.label}>Supabase URL</Text>
          <TextInput
            style={styles.input}
            value={supabaseUrl}
            onChangeText={setSupabaseUrl}
            autoCapitalize="none"
            placeholder="https://abcd.supabase.co"
            placeholderTextColor={COLORS.textMuted}
          />
          <Text style={styles.label}>Anon key</Text>
          <TextInput
            style={styles.input}
            value={supabaseAnon}
            onChangeText={setSupabaseAnon}
            autoCapitalize="none"
          />
          <Text style={styles.label}>Access token (JWT)</Text>
          <TextInput
            style={styles.input}
            value={supabaseToken}
            onChangeText={setSupabaseToken}
            autoCapitalize="none"
            secureTextEntry
          />
        </>
      )}

      <TouchableOpacity style={styles.primaryBtn} onPress={onSync} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={COLORS.text} />
        ) : (
          <Text style={styles.primaryBtnText}>Sync now</Text>
        )}
      </TouchableOpacity>

      {lastResult && (
        <View style={styles.resultBox}>
          <Text style={styles.resultLine}>Uploaded: {lastResult.uploaded}</Text>
          <Text style={styles.resultLine}>Downloaded: {lastResult.downloaded}</Text>
          <Text style={styles.resultLine}>Conflicts resolved: {lastResult.conflictsResolved}</Text>
          <Text style={styles.resultLine}>Skipped: {lastResult.skipped}</Text>
          {lastResult.errors.length > 0 && (
            <Text style={[styles.resultLine, { color: COLORS.danger }]}>
              {lastResult.errors.length} error(s)
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  body: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 20 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipSelected: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: COLORS.textSecondary, fontSize: 13 },
  chipTextSelected: { color: COLORS.text, fontWeight: '700' },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 12,
    color: COLORS.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  primaryBtn: {
    marginTop: 24,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: COLORS.text, fontWeight: '700', fontSize: 15 },
  resultBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultLine: { color: COLORS.text, fontSize: 13, lineHeight: 22 },
});
