import { useEffect, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { Screen } from '../design/Screen';
import { colors } from '../design/theme';
import { getMyProfile } from '../lib/api';
import { fromKg, roundWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { fetchOneRepMax, fetchRepPRs, type OneRepMax, type RepPR } from '../workouts/prQueries';
import {
  completedSetsOnly,
  fetchWorkoutDetail,
  type CompletedSetRecord,
  type WorkoutDetail,
} from '../workouts/workoutQueries';
import { workoutDetailStyles as styles } from './workoutDetailStyles';

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
//
// Layout: the workout's name and date in the header (Back on the left, Share
// on the right once it is completed), then each exercise as a plain block
// separated by hairlines -- name (opens its PR history), top set, and a row
// per logged set with a quiet PR / 1RM word while that set is still the live
// record.
export function WorkoutDetailScreen({ route, navigation }: Props) {
  const { workoutId } = route.params;
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const { theme } = useProgressTheme();

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [repPRs, setRepPRs] = useState<Record<string, RepPR[]>>({});
  const [oneRepMaxes, setOneRepMaxes] = useState<Record<string, OneRepMax | null>>({});
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
        if (cancelled) return;
        setWorkout(detail);
        setWeightUnit(profile.weightUnit);

        // Whether each historical set is *still* the live PR/1RM record, not
        // whether it was one at the time it was logged -- always re-read
        // against the database's current, authoritative state.
        const prEntries = await Promise.all(
          detail.exercises.map(async (exercise) => {
            const [prs, orm] = await Promise.all([
              fetchRepPRs(userId, exercise.exerciseId),
              fetchOneRepMax(userId, exercise.exerciseId),
            ]);
            return [exercise.id, prs, orm] as const;
          }),
        );
        if (!cancelled) {
          setRepPRs(Object.fromEntries(prEntries.map(([id, prs]) => [id, prs])));
          setOneRepMaxes(Object.fromEntries(prEntries.map(([id, , orm]) => [id, orm])));
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
  }, [workoutId, userId, accessToken]);

  if (loading || !workout) {
    return (
      <Screen
        scroll={false}
        header={
          <AppHeader
            leftAction={{
              icon: 'arrow-left',
              onPress: () => navigation.goBack(),
              accessibilityLabel: 'Back',
              testID: 'workout-detail-back',
            }}
          />
        }
      >
        {error ? (
          <Text testID="workout-detail-error" style={styles.errorText}>
            {error}
          </Text>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator
              testID="workout-detail-loading"
              size="large"
              color={colors.textPrimary}
            />
          </View>
        )}
      </Screen>
    );
  }

  return (
    <Screen
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          title={workout.name}
          subtitle={formatDateTime(workout.performedAt)}
          leftAction={{
            icon: 'arrow-left',
            onPress: () => navigation.goBack(),
            accessibilityLabel: 'Back',
            testID: 'workout-detail-back',
          }}
          rightAction={
            workout.completedAt
              ? {
                  icon: 'share',
                  onPress: () => navigation.navigate('ShareWorkout', { workoutId }),
                  accessibilityLabel: 'Share workout',
                  testID: 'workout-detail-share',
                }
              : undefined
          }
        />
      }
    >
      {workout.exercises.map((exercise, index) => {
        // A workout's history view only ever shows sets that were actually
        // logged -- a blank/incomplete set left over from a live session
        // that was completed anyway is not real performance data.
        const loggedSets = completedSetsOnly(exercise.sets);
        const topSet = loggedSets.reduce<CompletedSetRecord | null>(
          (max, s) => (!max || s.weightKg > max.weightKg ? s : max),
          null,
        );
        return (
          <View
            key={exercise.id}
            testID={`exercise-card-${exercise.id}`}
            style={[styles.exerciseBlock, index > 0 && styles.exerciseDivider]}
          >
            <TouchableOpacity
              testID={`exercise-title-${exercise.id}`}
              style={styles.exerciseTitleRow}
              onPress={() =>
                navigation.navigate('PRHistory', {
                  exerciseId: exercise.exerciseId,
                  exerciseName: exercise.exerciseName,
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`${exercise.exerciseName}, view PR history`}
            >
              <Text style={styles.exerciseTitle}>{exercise.exerciseName}</Text>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {topSet ? (
              <Text testID={`top-set-${exercise.id}`} style={styles.topSet}>
                Top set: {formatWeight(topSet.weightKg, weightUnit)}
                {weightUnit}
                {'×'}
                {topSet.reps}
              </Text>
            ) : null}
            {loggedSets.map((set) => {
              const isCurrentRepPR = repPRs[exercise.id]?.some(
                (pr) => pr.reps === set.reps && pr.sourceSetId === set.id,
              );
              const isCurrentOneRepMax = oneRepMaxes[exercise.id]?.sourceSetId === set.id;
              return (
                <View key={set.id} style={styles.setRow}>
                  <Text style={styles.setLabel}>Set {set.setIndex}</Text>
                  <Text style={styles.setValue}>
                    {formatWeight(set.weightKg, weightUnit)}
                    {weightUnit} × {set.reps}
                  </Text>
                  {isCurrentOneRepMax || isCurrentRepPR ? (
                    <Text
                      testID={`pr-tag-${set.id}`}
                      style={[styles.prTag, { color: theme.accent }]}
                    >
                      {isCurrentOneRepMax ? '1RM' : 'PR'}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      })}
    </Screen>
  );
}
