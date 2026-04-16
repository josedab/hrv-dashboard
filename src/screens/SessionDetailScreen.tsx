import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { VerdictDisplay } from '../components/VerdictDisplay';
import { StatCard } from '../components/StatCard';
import { COLORS } from '../constants/colors';
import { STRINGS } from '../constants/strings';
import { Session } from '../types';
import { getSessionById } from '../database/sessionRepository';
import { formatDateTime } from '../utils/date';
import { ARTIFACT_WARNING_THRESHOLD } from '../constants/defaults';

type DetailRouteProp = RouteProp<RootStackParamList, 'SessionDetail'>;

export function SessionDetailScreen() {
  const route = useRoute<DetailRouteProp>();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    getSessionById(route.params.sessionId).then(setSession);
  }, [route.params.sessionId]);

  if (!session) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  const artifactWarning = session.artifactRate > ARTIFACT_WARNING_THRESHOLD;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.date}>{formatDateTime(session.timestamp)}</Text>

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

      {(session.perceivedReadiness || session.trainingType || session.notes || session.sleepHours || session.stressLevel) && (
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
                {session.sleepHours}h{session.sleepQuality ? ` · Quality: ${session.sleepQuality}/5` : ''}
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
  date: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
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
});
