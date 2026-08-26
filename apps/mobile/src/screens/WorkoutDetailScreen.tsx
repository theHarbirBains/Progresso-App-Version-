import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { fromKg, roundWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { fetchWorkoutDetail, type SetRecord, type WorkoutDetail } from '../workouts/workoutQueries';
import { workoutStyles as styles } from './workoutStyles';

type Props = RootStackScreenProps<'WorkoutDetail'>;

function formatWeight(kg: number, unit: 'kg' | 'lb'): string {
  const value = roundWeight(fromKg(kg, unit));
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Read-only history view -- top set is a pure client-side derivation over
// the sets already fetched for display, matching the Phase 3 top-set
// foundation (no separate storage or query).
export function WorkoutDetailScreen({ route, navigation }: Props) {
  const { workoutId } = route.params;
  const { session } = useAuth();
  const accessToken = session?.access_token;

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!accessToken) return;
      setLoading(true);
      setError(null);
      try {
        const [detail, profile] = await Promise.all([
          fetchWorkoutDetail(workoutId),
          getMyProfile(accessToken),
        ]);
        if (!cancelled) {
          setWorkout(detail);
          setWeightUnit(profile.weightUnit);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load workout');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [workoutId, accessToken]);

  if (loading || !workout) {
    return (
      <View style={styles.container}>
        {error ? (
          <Text testID="workout-detail-error" style={styles.error}>
            {error}
          </Text>
        ) : (
          <ActivityIndicator testID="workout-detail-loading" size="large" color="#FFFFFF" />
        )}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{workout.name}</Text>
        <TouchableOpacity testID="workout-detail-back" onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>Back</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.info}>{formatDateTime(workout.performedAt)}</Text>

      {workout.exercises.map((exercise) => {
        const topSet = exercise.sets.reduce<SetRecord | null>(
          (max, s) => (!max || s.weightKg > max.weightKg ? s : max),
          null,
        );
        return (
          <View key={exercise.id} testID={`exercise-card-${exercise.id}`} style={styles.card}>
            <Text style={styles.cardTitle}>{exercise.exerciseName}</Text>
            {topSet ? (
              <Text testID={`top-set-${exercise.id}`} style={styles.cardMetaHighlight}>
                Top set: {formatWeight(topSet.weightKg, weightUnit)}
                {weightUnit}
                {'×'}
                {topSet.reps}
              </Text>
            ) : null}
            {exercise.sets.map((set) => (
              <Text key={set.id} style={styles.cardMeta}>
                Set {set.setIndex}: {formatWeight(set.weightKg, weightUnit)}
                {weightUnit} × {set.reps}
              </Text>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}
