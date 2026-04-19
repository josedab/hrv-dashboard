import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { COLORS } from '../constants/colors';
import {
  AthleteProfile,
  getProfiles,
  createProfile,
  setActiveProfile,
  deleteProfile,
} from '../utils/profiles';

export function ProfilesScreen() {
  const [profiles, setProfiles] = useState<AthleteProfile[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getProfiles();
      setProfiles(list);
    } catch {
      // profiles table may not exist on first launch before migration
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onAdd = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await createProfile(trimmed);
      setNewName('');
      await refresh();
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    }
  }, [newName, refresh]);

  const onActivate = useCallback(
    async (id: string) => {
      await setActiveProfile(id);
      await refresh();
    },
    [refresh]
  );

  const onDelete = useCallback(
    (profile: AthleteProfile) => {
      Alert.alert('Delete Profile', `Remove "${profile.name}"? Sessions are not deleted.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteProfile(profile.id);
            await refresh();
          },
        },
      ]);
    },
    [refresh]
  );

  const activeProfile = profiles.find((p) => p.isActive);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Athlete Profiles</Text>
      <Text style={styles.subtitle}>
        Switch between athletes on the same device. Each profile tracks its own sessions and
        baseline.
      </Text>

      {activeProfile && (
        <View style={styles.activeCard}>
          <Text style={styles.activeLabel}>Active Profile</Text>
          <Text style={styles.activeName}>{activeProfile.name}</Text>
        </View>
      )}

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="New profile name"
          placeholderTextColor={COLORS.textMuted}
          value={newName}
          onChangeText={setNewName}
          maxLength={100}
          returnKeyType="done"
          onSubmitEditing={onAdd}
        />
        <TouchableOpacity
          style={[styles.addButton, !newName.trim() && styles.addButtonDisabled]}
          onPress={onAdd}
          disabled={!newName.trim()}
          accessibilityRole="button"
          accessibilityLabel="Add profile"
        >
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {!loading && profiles.length === 0 && (
        <Text style={styles.emptyText}>No profiles yet. Create one above.</Text>
      )}

      {profiles.map((profile) => (
        <View key={profile.id} style={styles.profileRow}>
          <TouchableOpacity
            style={styles.profileInfo}
            onPress={() => onActivate(profile.id)}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${profile.name}`}
          >
            <View
              style={[styles.avatar, profile.isActive && styles.avatarActive]}
              accessibilityLabel={profile.isActive ? 'Active' : 'Inactive'}
            >
              <Text style={styles.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.profileName}>{profile.name}</Text>
              {profile.isActive && <Text style={styles.profileActive}>Active</Text>}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete(profile)}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${profile.name}`}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.textMuted, marginBottom: 24 },
  activeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
  },
  activeLabel: { fontSize: 11, color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 4 },
  activeName: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  input: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 15,
  },
  addButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  addButtonDisabled: { opacity: 0.4 },
  addButtonText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 32 },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  profileInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActive: { backgroundColor: COLORS.accent },
  avatarText: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  profileName: { fontSize: 16, color: COLORS.text, fontWeight: '500' },
  profileActive: { fontSize: 12, color: COLORS.accent, marginTop: 2 },
  deleteText: { color: COLORS.danger, fontSize: 14 },
});
