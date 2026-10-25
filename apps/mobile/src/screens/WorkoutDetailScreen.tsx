import { useEffect, useState } from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { TextButton } from '../design/Button';
import { Badge } from '../design/Badge';
import { Screen } from '../design/Screen';
import { StatBlock } from '../design/StatBlock';
import { colors } from '../design/theme';
import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import { formatWeightKg } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { measurementTypeOf, type MeasurementType } from '../exercises/movementTypes';
import {
  fetchDurationRecord,
  fetchOneRepMax,
  fetchRepPRs,
  fetchRepRecord,
  type ExerciseRecord,
  type OneRepMax,
  type RepPR,
} from '../workouts/prQueries';
import { bestLoggedSet, formatSetValues, loggedSets, setValuesOf } from '../workouts/setValues';
import { computeDurationMinutes } from '../workouts/topSetSummary';
import {
  completedSetsOnly,
  deleteWorkout,
  fetchWorkoutDetail,
  type SetRecord,
  type WorkoutDetail,
} from '../workouts/workoutQueries';
import { formatCardDuration } from '../workouts/workoutFormat';
import { formatVolume, volumeInUnit } from '../workouts/workoutSummary';
import { workoutDetailStyles as styles } from './workoutDetailStyles';
import { SkeletonCards } from '../design/Skeleton';

type Props = RootStackScreenProps<'WorkoutDetail'>;

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
// on the right once it is completed), then a stack of widgets 6px apart: a
// summary card (muscles trained, and duration / sets / volume / records as
// stat blocks) and one card per exercise -- its name (opens PR history), the
// top set called out, and a row per logged set with a PR / 1RM badge while
// that set is still the live record.
export function WorkoutDetailScreen({ route, navigation }: Props) {
  const { workoutId, clientId, clientName } = route.params;
  const { refetch: refetchAllTimeStats } = useAllTimeStats();

  // A trainer removes a client's workout from the client's history, or the user
  // removes one of their own, from their own history -- either way it's a soft
  // delete (deleteWorkout) and can't be logged again.
  function confirmDeleteWorkout() {
    Alert.alert(
      'Delete this workout?',
      clientId
        ? 'It will be removed from the client’s history. This cannot be undone.'
        : 'It will be removed from your history. This cannot be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteWorkout(workoutId)
              .then(() => {
                // A client's workout was never part of the trainer's own stats.
                if (!clientId) void refetchAllTimeStats();
                navigation.goBack();
              })
              .catch((err: unknown) =>
                Alert.alert('Could not delete', err instanceof Error ? err.message : 'Try again'),
              );
          },
        },
      ],
    );
  }

  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const { theme, weightUnit } = useProgressTheme();

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [repPRs, setRepPRs] = useState<Record<string, RepPR[]>>({});
  const [oneRepMaxes, setOneRepMaxes] = useState<Record<string, OneRepMax | null>>({});
  // A bodyweight or timed exercise's record (most reps, longest time), by logged exercise.
  const [otherRecords, setOtherRecords] = useState<Record<string, ExerciseRecord | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!accessToken) return;
      setLoading(true);
      setError(null);
      try {
        const detail = await fetchWorkoutDetail(workoutId);
        if (cancelled) return;
        setWorkout(detail);

        // Whether each historical set is *still* the live PR/1RM record, not
        // whether it was one at the time it was logged -- always re-read
        // against the database's current, authoritative state.
        const prEntries = await Promise.all(
          detail.exercises.map(async (exercise) => {
            const type = measurementTypeOf(exercise);
            if (type !== 'weight_reps') {
              const record =
                type === 'timed'
                  ? await fetchDurationRecord(userId, exercise.exerciseId)
                  : await fetchRepRecord(userId, exercise.exerciseId);
              return [exercise.id, [] as RepPR[], null, record] as const;
            }
            const [prs, orm] = await Promise.all([
              fetchRepPRs(userId, exercise.exerciseId),
              fetchOneRepMax(userId, exercise.exerciseId),
            ]);
            return [exercise.id, prs, orm, null] as const;
          }),
        );
        if (!cancelled) {
          setRepPRs(Object.fromEntries(prEntries.map(([id, prs]) => [id, prs])));
          setOneRepMaxes(Object.fromEntries(prEntries.map(([id, , orm]) => [id, orm])));
          setOtherRecords(Object.fromEntries(prEntries.map(([id, , , record]) => [id, record])));
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
          <SkeletonCards testID="workout-detail-loading" heights={[160, 200, 200]} />
        )}
      </Screen>
    );
  }

  // The workout as a whole, from the sets that were actually logged -- each holding what its
  // exercise records (weight and reps; reps; a time).
  const loggedByExercise = workout.exercises.map((exercise) => {
    const type = measurementTypeOf(exercise);
    return { exercise, type, sets: loggedSets(exercise.sets, type) };
  });
  // Volume is weight x reps: weighted exercises only.
  const weightedLogged = loggedByExercise
    .filter((entry) => entry.type === 'weight_reps')
    .flatMap((entry) => completedSetsOnly(entry.sets));
  const totalVolume = volumeInUnit(weightedLogged, weightUnit);
  const loggedSetCount = loggedByExercise.reduce((sum, entry) => sum + entry.sets.length, 0);
  const durationMinutes = computeDurationMinutes(workout.performedAt, workout.completedAt);
  const isRecord = (exerciseId: string, type: MeasurementType, set: SetRecord) =>
    type === 'weight_reps'
      ? Boolean(
          repPRs[exerciseId]?.some((pr) => pr.reps === set.reps && pr.sourceSetId === set.id),
        ) || oneRepMaxes[exerciseId]?.sourceSetId === set.id
      : otherRecords[exerciseId]?.sourceSetId === set.id;
  const recordCount = loggedByExercise.reduce(
    (sum, { exercise, type, sets }) =>
      sum + sets.filter((set) => isRecord(exercise.id, type, set)).length,
    0,
  );
  const muscles = Array.from(
    new Set(workout.exercises.map((e) => MUSCLE_GROUP_LABELS[e.muscleGroup])),
  ).join(' • ');

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
          rightAction={{
            icon: 'edit-2',
            onPress: () => navigation.navigate('EditWorkout', { workoutId, clientId, clientName }),
            accessibilityLabel: 'Edit workout',
            testID: 'workout-detail-edit',
          }}
          rightAction2={
            workout.completedAt && !clientId
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
      <AppCard hero topAccent={theme.accent} testID="workout-detail-summary">
        {muscles ? <Text style={styles.eyebrow}>{muscles}</Text> : null}
        <View style={styles.statGrid}>
          <View style={styles.statRow}>
            <StatBlock
              testID="workout-detail-stat-duration"
              value={durationMinutes !== null ? formatCardDuration(durationMinutes) : '--'}
              label="Duration"
            />
            <StatBlock
              testID="workout-detail-stat-sets"
              value={String(loggedSetCount)}
              label="Sets"
            />
          </View>
          <View style={styles.statRow}>
            <StatBlock
              testID="workout-detail-stat-volume"
              value={`${formatVolume(totalVolume)} ${weightUnit}`}
              label="Volume"
            />
            <StatBlock
              testID="workout-detail-stat-records"
              value={String(recordCount)}
              label={recordCount === 1 ? 'Record' : 'Records'}
              valueColor={recordCount > 0 ? theme.accent : undefined}
            />
          </View>
        </View>
      </AppCard>

      {loggedByExercise.map(({ exercise, type, sets: exerciseSets }) => {
        // A workout's history view only ever shows sets that were actually
        // logged -- a blank/incomplete set left over from a live session
        // that was completed anyway is not real performance data.
        const topSet = bestLoggedSet(exerciseSets, type);
        return (
          <AppCard key={exercise.id} testID={`exercise-card-${exercise.id}`}>
            {/* PR history is weighted rep PRs and 1RMs: a bodyweight or timed exercise's
                title opens nothing, and its record shows on its set instead. */}
            <TouchableOpacity
              testID={`exercise-title-${exercise.id}`}
              style={styles.exerciseTitleRow}
              onPress={() =>
                navigation.navigate('PRHistory', {
                  exerciseId: exercise.exerciseId,
                  exerciseName: exercise.exerciseName,
                })
              }
              disabled={type !== 'weight_reps'}
              accessibilityRole={type === 'weight_reps' ? 'button' : undefined}
              accessibilityLabel={
                type === 'weight_reps' ? `${exercise.exerciseName}, view PR history` : undefined
              }
            >
              <View style={styles.exerciseTitleBody}>
                <Text style={styles.exerciseTitle}>{exercise.exerciseName}</Text>
                <Text style={styles.exerciseMuscle}>
                  {MUSCLE_GROUP_LABELS[exercise.muscleGroup]}
                </Text>
              </View>
              {type === 'weight_reps' ? (
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              ) : null}
            </TouchableOpacity>
            {topSet ? (
              <View style={styles.topSetBlock}>
                <Text
                  testID={`top-set-${exercise.id}`}
                  style={[styles.topSet, { color: theme.accent }]}
                >
                  {type === 'weight_reps' ? (
                    <>
                      Top set: {formatWeightKg(topSet.weightKg ?? 0, weightUnit)}
                      {weightUnit}
                      {'×'}
                      {topSet.reps}
                    </>
                  ) : (
                    `${type === 'timed' ? 'Longest' : 'Best set'}: ${formatSetValues(
                      setValuesOf(topSet, type),
                      weightUnit,
                    )}`
                  )}
                </Text>
              </View>
            ) : null}
            <View style={styles.sets}>
              {exerciseSets.map((set) => {
                const oneRepMax =
                  type === 'weight_reps' && oneRepMaxes[exercise.id]?.sourceSetId === set.id;
                const record = isRecord(exercise.id, type, set);
                return (
                  <View key={set.id} style={styles.setRow}>
                    <Text style={styles.setLabel}>Set {set.setIndex}</Text>
                    <Text style={styles.setValue}>
                      {type === 'weight_reps'
                        ? `${formatWeightKg(set.weightKg ?? 0, weightUnit)}${weightUnit} × ${set.reps}`
                        : formatSetValues(setValuesOf(set, type), weightUnit)}
                    </Text>
                    {record ? (
                      <Badge
                        testID={`pr-tag-${set.id}`}
                        label={oneRepMax ? '1RM' : 'PR'}
                        color={theme.accent}
                        backgroundColor={theme.accentBg}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          </AppCard>
        );
      })}

      <TextButton
        testID="workout-detail-delete"
        label="Delete Workout"
        destructive
        onPress={confirmDeleteWorkout}
      />
    </Screen>
  );
}
