import { useEffect, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { Badge } from '../design/Badge';
import { Screen } from '../design/Screen';
import { StatBlock } from '../design/StatBlock';
import { colors } from '../design/theme';
import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import { getMyProfile } from '../lib/api';
import { formatWeightKg } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { fetchOneRepMax, fetchRepPRs, type OneRepMax, type RepPR } from '../workouts/prQueries';
import {
  completedSetsOnly,
  fetchWorkoutDetail,
  type CompletedSetRecord,
  type WorkoutDetail,
} from '../workouts/workoutQueries';
import { formatCardDuration } from '../workouts/workoutFormat';
import { workoutDetailStyles as styles } from './workoutDetailStyles';

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

  // The workout as a whole, from the sets that were actually logged.
  const loggedByExercise = workout.exercises.map((exercise) => ({
    exercise,
    sets: completedSetsOnly(exercise.sets),
  }));
  const allLogged = loggedByExercise.flatMap((entry) => entry.sets);
  const totalVolumeKg = allLogged.reduce((sum, set) => sum + set.weightKg * set.reps, 0);
  const durationMinutes = workout.completedAt
    ? Math.round(
        (new Date(workout.completedAt).getTime() - new Date(workout.performedAt).getTime()) / 60000,
      )
    : null;
  const isRecord = (exerciseId: string, set: CompletedSetRecord, reps: number) =>
    Boolean(repPRs[exerciseId]?.some((pr) => pr.reps === reps && pr.sourceSetId === set.id)) ||
    oneRepMaxes[exerciseId]?.sourceSetId === set.id;
  const recordCount = loggedByExercise.reduce(
    (sum, { exercise, sets }) =>
      sum + sets.filter((set) => isRecord(exercise.id, set, set.reps)).length,
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
              value={String(allLogged.length)}
              label="Sets"
            />
          </View>
          <View style={styles.statRow}>
            <StatBlock
              testID="workout-detail-stat-volume"
              value={`${Number(formatWeightKg(totalVolumeKg, weightUnit)).toLocaleString()} ${weightUnit}`}
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

      {loggedByExercise.map(({ exercise, sets: loggedSets }) => {
        // A workout's history view only ever shows sets that were actually
        // logged -- a blank/incomplete set left over from a live session
        // that was completed anyway is not real performance data.
        const topSet = loggedSets.reduce<CompletedSetRecord | null>(
          (max, s) => (!max || s.weightKg > max.weightKg ? s : max),
          null,
        );
        return (
          <AppCard key={exercise.id} testID={`exercise-card-${exercise.id}`}>
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
              <View style={styles.exerciseTitleBody}>
                <Text style={styles.exerciseTitle}>{exercise.exerciseName}</Text>
                <Text style={styles.exerciseMuscle}>
                  {MUSCLE_GROUP_LABELS[exercise.muscleGroup]}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {topSet ? (
              <View style={styles.topSetBlock}>
                <Text
                  testID={`top-set-${exercise.id}`}
                  style={[styles.topSet, { color: theme.accent }]}
                >
                  Top set: {formatWeightKg(topSet.weightKg, weightUnit)}
                  {weightUnit}
                  {'×'}
                  {topSet.reps}
                </Text>
              </View>
            ) : null}
            <View style={styles.sets}>
              {loggedSets.map((set) => {
                const oneRepMax = oneRepMaxes[exercise.id]?.sourceSetId === set.id;
                const record = isRecord(exercise.id, set, set.reps);
                return (
                  <View key={set.id} style={styles.setRow}>
                    <Text style={styles.setLabel}>Set {set.setIndex}</Text>
                    <Text style={styles.setValue}>
                      {formatWeightKg(set.weightKg, weightUnit)}
                      {weightUnit} × {set.reps}
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
    </Screen>
  );
}
