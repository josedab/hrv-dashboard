/** Coach share screen — generate encrypted share bundles with pairing codes. */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../constants/colors';
import { sealShare } from '../share';
import { getAllSessions } from '../database/sessionRepository';
import { getErrorMessage } from '../utils/errors';

export function ShareCoachScreen() {
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [bundleJson, setBundleJson] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const onGenerate = useCallback(async () => {
    setBusy(true);
    setCode(null);
    setBundleJson(null);
    try {
      const sessions = await getAllSessions();
      const sealed = await sealShare(sessions, {
        athleteName: 'Athlete',
        lookbackDays: days,
      });
      setCode(sealed.pairingCode);
      setBundleJson(JSON.stringify(sealed.bundle));
    } catch (err) {
      Alert.alert('Could not generate code', getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [days]);

  const onShare = useCallback(async () => {
    if (!code || !bundleJson) return;
    try {
      await Share.share({
        message: `HRV share code: ${code}\n\nBundle (paste into coach app):\n${bundleJson}`,
      });
    } catch {
      // user cancelled
    }
  }, [code, bundleJson]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Share with a coach</Text>
      <Text style={styles.body}>
        Generates a one-time encrypted bundle of your last {days} days. The pairing code below is
        the only way to decrypt it. Share both the bundle and the code with your coach.
      </Text>

      <Text style={styles.label}>Lookback window</Text>
      <View style={styles.row}>
        {[7, 14, 30, 90].map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.chip, days === d && styles.chipSelected]}
            onPress={() => setDays(d)}
          >
            <Text style={[styles.chipText, days === d && styles.chipTextSelected]}>{d}d</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={onGenerate} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={COLORS.text} />
        ) : (
          <Text style={styles.primaryBtnText}>Generate share code</Text>
        )}
      </TouchableOpacity>

      {code && (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Pairing code</Text>
          <Text style={styles.codeText} selectable>
            {code}
          </Text>
          <TouchableOpacity style={[styles.primaryBtn, { marginTop: 12 }]} onPress={onShare}>
            <Text style={styles.primaryBtnText}>Share bundle…</Text>
          </TouchableOpacity>
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipSelected: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: COLORS.textSecondary, fontSize: 13 },
  chipTextSelected: { color: COLORS.text, fontWeight: '700' },
  primaryBtn: {
    marginTop: 24,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: COLORS.text, fontWeight: '700', fontSize: 15 },
  codeBox: {
    marginTop: 24,
    padding: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  codeLabel: { color: COLORS.textMuted, fontSize: 12, textTransform: 'uppercase', marginBottom: 8 },
  codeText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: 'Courier',
  },
});
