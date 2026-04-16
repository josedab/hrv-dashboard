import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ReadinessSlider } from '../components/ReadinessSlider';
import { VerdictDisplay } from '../components/VerdictDisplay';
import { COLORS } from '../constants/colors';
import { TRAINING_TYPES } from '../constants/defaults';
import { getSessionById, updateSessionLog } from '../database/sessionRepository';
import { Session } from '../types';

type LogNavProp = NativeStackNavigationProp<RootStackParamList>;
type LogRouteProp = RouteProp<RootStackParamList, 'Log'>;

export function LogScreen() {
  const navigation = useNavigation<LogNavProp>();
  const route = useRoute<LogRouteProp>();
  const { sessionId } = route.params;

  const [session, setSession] = useState<Session | null>(null);
  const [readiness, setReadiness] = useState<number | null>(null);
  const [trainingType, setTrainingType] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [sleepHours, setSleepHours] = useState<number | null>(null);
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [stressLevel, setStressLevel] = useState<number | null>(null);

  const NOTES_MAX_LENGTH = 500;

  useEffect(() => {
    getSessionById(sessionId).then(setSession);
  }, [sessionId]);

  const handleSave = async () => {
    try {
      await updateSessionLog(sessionId, readiness, trainingType, notes || null, sleepHours, sleepQuality, stressLevel);
      navigation.popToTop();
    } catch (error) {
      Alert.alert('Error', 'Failed to save log.');
    }
  };

  const handleSkip = () => {
    navigation.popToTop();
  };

  if (!session) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <VerdictDisplay verdict={session.verdict} rmssd={session.rmssd} size="small" />

      <ReadinessSlider value={readiness} onChange={setReadiness} />

      <Text style={styles.label}>Training Type</Text>
      <View style={styles.trainingTypes}>
        {TRAINING_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.chip, trainingType === type && styles.chipSelected]}
            onPress={() => setTrainingType(trainingType === type ? null : type)}
          >
            <Text style={[styles.chipText, trainingType === type && styles.chipTextSelected]}>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={styles.textInput}
        placeholder="How are you feeling?"
        placeholderTextColor={COLORS.textMuted}
        multiline
        value={notes}
        onChangeText={setNotes}
        maxLength={NOTES_MAX_LENGTH}
      />
      <Text style={styles.charCount}>{notes.length}/{NOTES_MAX_LENGTH}</Text>

      <Text style={styles.label}>Sleep (optional)</Text>
      <View style={styles.sleepRow}>
        {[5, 6, 7, 8, 9].map((hrs) => (
          <TouchableOpacity
            key={`sleep-${hrs}`}
            style={[styles.chip, sleepHours === hrs && styles.chipSelected]}
            onPress={() => setSleepHours(sleepHours === hrs ? null : hrs)}
          >
            <Text style={[styles.chipText, sleepHours === hrs && styles.chipTextSelected]}>{hrs}h</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Sleep Quality</Text>
      <View style={styles.sleepRow}>
        {[1, 2, 3, 4, 5].map((q) => (
          <TouchableOpacity
            key={`sq-${q}`}
            style={[styles.chip, sleepQuality === q && styles.chipSelected]}
            onPress={() => setSleepQuality(sleepQuality === q ? null : q)}
          >
            <Text style={[styles.chipText, sleepQuality === q && styles.chipTextSelected]}>
              {['😴', '😕', '😐', '🙂', '😊'][q - 1]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Stress Level</Text>
      <View style={styles.sleepRow}>
        {[1, 2, 3, 4, 5].map((s) => (
          <TouchableOpacity
            key={`stress-${s}`}
            style={[styles.chip, stressLevel === s && styles.chipSelected]}
            onPress={() => setStressLevel(stressLevel === s ? null : s)}
          >
            <Text style={[styles.chipText, stressLevel === s && styles.chipTextSelected]}>
              {['😌', '🙂', '😐', '😰', '🤯'][s - 1]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipButtonText}>Skip</Text>
      </TouchableOpacity>
    </ScrollView>
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
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 12,
  },
  trainingTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: COLORS.text,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    color: COLORS.text,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  sleepRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  saveButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  skipButtonText: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
});
