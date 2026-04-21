/** Session detail screen — full metrics view for a historical recording (RR plot, stats, log). */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { VerdictDisplay } from '../components/VerdictDisplay';
import { StatCard } from '../components/StatCard';
import { RRPlot } from '../components/RRPlot';
import { Toast } from '../components/Toast';
import { COLORS } from '../constants/colors';
import { STRINGS } from '../constants/strings';
import { Session } from '../types';
import { getSessionById, deleteSession, saveSession } from '../database/sessionRepository';
import { formatDateTime } from '../utils/date';
import { ARTIFACT_WARNING_THRESHOLD } from '../constants/defaults';
import { fireAndForget } from '../utils/errors';

type DetailRouteProp = RouteProp<RootStackParamList, 'SessionDetail'>;
type DetailNavProp = NativeStackNavigationProp<RootStackParamList>;

export function SessionDetailScreen() {
  const route = useRoute<DetailRouteProp>();
  const navigation = useNavigation<DetailNavProp>();
  const [session, setSession] = useState<Session | null>(null);
  const [toast, setToast] = useState<{ message: string; action?: () => void } | null>(null);

  useEffect(() => {
    fireAndForget(getSessionById(route.params.sessionId).then(setSession), 'load-session-detail');
  }, [route.params.sessionId]);

  const handleEdit = useCallback(() => {
    if (!session) return;
    navigation.navigate('Log', { sessionId: session.id });
  }, [navigation, session]);

  const handleDelete = useCallback(() => {
    if (!session) return;
    Alert.alert(STRINGS.confirmDeleteTitle, STRINGS.confirmDeleteMessage, [
      { text: STRINGS.cancel, style: 'cancel' },
      {
        text: STRINGS.delete,
        style: 'destructive',
        onPress: async () => {
          const snapshot = session;
          try {
            await deleteSession(session.id);
            setToast({
              message: STRINGS.sessionDeleted,
              action: async () => {
                try {
                  await saveSession(snapshot);
                } catch (err) {
                  console.error('Undo delete failed:', err);
                }
              },
            });
            setTimeout(() => navigation.goBack(), 250);
          } catch (err) {
            console.error('Delete failed:', err);
            Alert.alert(STRINGS.error, 'Failed to delete session.');
          }
        },
      },
    ]);
  }, [session, navigation]);

  if (!session) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: COLORS.background,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  const artifactWarning = session.artifactRate > ARTIFACT_WARNING_THRESHOLD;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.date}>{formatDateTime(session.timestamp)}</Text>
        {session.source === 'camera' && (
          <View style={styles.cameraBadge}>
            <Text style={styles.cameraBadgeText}>📸 Camera reading · excluded from baseline</Text>
          </View>
        )}

        <VerdictDisplay verdict={session.verdict} rmssd={session.rmssd} size="large" />

        <Text style={styles.sectionTitle}>{STRINGS.hrvMetrics}</Text>
        <View style={styles.statsRow}>
          <StatCard label="rMSSD" value={session.rmssd.toFixed(1)} unit="ms" />
          <StatCard label="SDNN" value={session.sdnn.toFixed(1)} unit="ms" />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="Mean HR" value={session.meanHr.toFixed(0)} unit="bpm" />
          <StatCard label="pNN50" value={session.pnn50.toFixed(1)} unit="%" />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            label="Artifact Rate"
            value={`${(session.artifactRate * 100).toFixed(1)}%`}
            warning={artifactWarning}
          />
          <StatCard
            label="Duration"
            value={`${Math.floor(session.durationSeconds / 60)}:${String(session.durationSeconds % 60).padStart(2, '0')}`}
            unit="min"
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="RR Intervals" value={`${session.rrIntervals.length}`} />
        </View>

        {session.rrIntervals.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>RR Intervals</Text>
            <View style={styles.plotWrap}>
              <RRPlot rrIntervals={session.rrIntervals} width={320} height={120} />
            </View>
          </>
        )}

        {(session.perceivedReadiness ||
          session.trainingType ||
          session.notes ||
          session.sleepHours ||
          session.stressLevel) && (
          <>
            <Text style={styles.sectionTitle}>{STRINGS.subjectiveLog}</Text>
            {session.perceivedReadiness && (
              <View style={styles.logItem}>
                <Text style={styles.logLabel}>Perceived Readiness</Text>
                <Text style={styles.logValue}>{session.perceivedReadiness}/5</Text>
              </View>
            )}
            {session.trainingType && (
              <View style={styles.logItem}>
                <Text style={styles.logLabel}>Training Type</Text>
                <Text style={styles.logValue}>{session.trainingType}</Text>
              </View>
            )}
            {session.sleepHours !== null && (
              <View style={styles.logItem}>
                <Text style={styles.logLabel}>Sleep</Text>
                <Text style={styles.logValue}>
                  {session.sleepHours}h
                  {session.sleepQuality ? ` · Quality: ${session.sleepQuality}/5` : ''}
                </Text>
              </View>
            )}
            {session.stressLevel !== null && (
              <View style={styles.logItem}>
                <Text style={styles.logLabel}>Stress Level</Text>
                <Text style={styles.logValue}>{session.stressLevel}/5</Text>
              </View>
            )}
            {session.notes && (
              <View style={styles.logItem}>
                <Text style={styles.logLabel}>Notes</Text>
                <Text style={styles.logValue}>{session.notes}</Text>
              </View>
            )}
          </>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={handleEdit}
            accessibilityRole="button"
            accessibilityLabel={STRINGS.editSession}
            activeOpacity={0.7}
          >
            <Text style={styles.editButtonText}>✏️ {STRINGS.editSession}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDelete}
            accessibilityRole="button"
            accessibilityLabel={STRINGS.deleteSession}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteButtonText}>🗑 {STRINGS.deleteSession}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {toast && (
        <Toast
          visible={true}
          message={toast.message}
          actionLabel={toast.action ? STRINGS.undo : undefined}
          onAction={toast.action}
          onHide={() => setToast(null)}
          duration={4000}
        />
      )}
    </>
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
  date: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  cameraBadge: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'center',
    marginBottom: 12,
  },
  cameraBadgeText: {
    color: COLORS.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 24,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  plotWrap: {
    alignItems: 'center',
  },
  logItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  logLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  logValue: {
    fontSize: 16,
    color: COLORS.text,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  editButtonText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  deleteButtonText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '600',
  },
});
