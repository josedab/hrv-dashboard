/** Workout-of-the-day card showing verdict-based training prescription with intensity stars. */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import { Session } from '../types';
import { generateWorkout, SportProfile, WorkoutPrescription } from '../workout/generator';

interface Props {
  session: Session | null;
  sport?: SportProfile;
}

/**
 * Renders today's recommended workout based on the latest session's verdict.
 * Displays headline, intensity stars, blocks summary and disclaimer.
 */
export function WorkoutCard({ session, sport = 'cycling' }: Props) {
  const workout: WorkoutPrescription = generateWorkout({ sport, session: session ?? undefined });
  const stars = '★'.repeat(workout.intensityStars) + '☆'.repeat(5 - workout.intensityStars);

  return (
    <View style={styles.card} accessibilityLabel="Workout of the day">
      <View style={styles.header}>
        <Text style={styles.title}>Workout of the day</Text>
        <Text style={styles.stars}>{stars}</Text>
      </View>
      <Text style={styles.headline}>{workout.headline}</Text>
      <Text style={styles.summary}>{workout.rationale}</Text>
      {workout.blocks.length > 0 && (
        <View style={styles.blocks}>
          {workout.blocks.slice(0, 4).map((b, i) => (
            <Text key={i} style={styles.block}>
              • {b.reps && b.reps > 1 ? `${b.reps}× ` : ''}
              {Math.round(b.durationSeconds / 60)} min — {b.zone.label}
            </Text>
          ))}
        </View>
      )}
      <Text style={styles.disclaimer}>{workout.disclaimer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stars: {
    fontSize: 14,
    color: COLORS.accent,
  },
  headline: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  summary: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 10,
    lineHeight: 20,
  },
  blocks: {
    marginBottom: 10,
  },
  block: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 20,
  },
  disclaimer: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
});
