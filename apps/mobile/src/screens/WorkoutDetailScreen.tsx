import { useEffect, useState } from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { TextButton } from '../design/Button';
import { Badge } from '../design/Badge';
import { FilterChips } from '../design/FilterChips';
import { Screen } from '../design/Screen';
import { StatBlock } from '../design/StatBlock';
import { colors } from '../design/theme';
import { UnderlineTabs } from '../design/UnderlineTabs';
import { ExercisePhoto } from '../exercises/ExercisePhoto';
import { machineLine } from '../exercises/machineDetails';
import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import { listTrainerClients } from '../lib/trainerApi';
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
import { workoutMuscleTabs, type MuscleTab } from '../workouts/workoutMuscleTabs';
import { formatVolume, volumeInUnit } from '../workouts/workoutSummary';
import { workoutDetailStyles as styles } from './workoutDetailStyles';
import { SkeletonCards } from '../design/Skeleton';
import {
  fetchGroupWorkouts,
  firstName,
  type GroupWorkoutPerson,
} from '../workouts/groupWorkoutHistory';

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
//
// A group workout shows everyone's: a tab per person across the top (You first by the
// group's order), each tab their own workout as they logged it. Only the workout the page was
// opened on is yours to edit, share or delete, and only its sets carry record tags -- another
// person's records are theirs. Someone who logged nothing (a trainer who only coached) has no
// tab, and Share only shows for a workout with something logged in it.
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
  // Everyone's workout in the group this one was part of; null when it wasn't one.
  const [people, setPeople] = useState<GroupWorkoutPerson[] | null>(null);
  const [selectedId, setSelectedId] = useState(workoutId);
  // Which muscle group's exercises show, as in the live workout; All to start.
  const [muscleTab, setMuscleTab] = useState<MuscleTab>('all');
  // In a group, the people who are this person's active clients: as their trainer, they can fix
  // a set logged wrong in that client's workout (as from the client's own page).
  const [clientIds, setClientIds] = useState<Set<string>>(new Set());
  // Records belong to the workout's owner: a trainer looking at a client's reads the client's.
  const ownerId = clientId ?? userId;

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
        if (detail.groupId) {
          // The rest of the group follows; the page shows this workout meanwhile.
          void fetchGroupWorkouts(accessToken, detail.groupId, detail).then((group) => {
            if (cancelled) return;
            setPeople(group);
            if (group && group.some((person) => person.userId !== userId)) {
              // Someone who isn't a trainer has no clients to read: nothing more to edit.
              listTrainerClients(accessToken)
                .then((clients) => {
                  if (cancelled) return;
                  setClientIds(
                    new Set(
                      clients
                        .filter((client) => client.status === 'active' && client.clientId)
                        .map((client) => client.clientId as string),
                    ),
                  );
                })
                .catch(() => undefined);
            }
          });
        }

        // Whether each historical set is *still* the live PR/1RM record, not
        // whether it was one at the time it was logged -- always re-read
        // against the database's current, authoritative state.
        const prEntries = await Promise.all(
          detail.exercises.map(async (exercise) => {
            const type = measurementTypeOf(exercise);
            if (type !== 'weight_reps') {
              const record =
                type === 'timed'
                  ? await fetchDurationRecord(ownerId, exercise.exerciseId)
                  : await fetchRepRecord(ownerId, exercise.exerciseId);
              return [exercise.id, [] as RepPR[], null, record] as const;
            }
            const [prs, orm] = await Promise.all([
              fetchRepPRs(ownerId, exercise.exerciseId),
              fetchOneRepMax(ownerId, exercise.exerciseId),
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
  }, [workoutId, ownerId, accessToken, userId]);

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

  // The person whose workout is showing: this one, or someone else's in the group.
  const shownPerson = people?.find((person) => person.workout.id === selectedId);
  const shown = shownPerson?.workout ?? workout;
  const isOwn = shown.id === workout.id;
  // Another person's workout in the group can be edited by their trainer, to fix a set logged
  // wrong -- under the trainer's link, recorded for the client like any trainer edit.
  const editsAsTrainer = !isOwn && shownPerson !== undefined && clientIds.has(shownPerson.userId);
  const canEdit = isOwn || editsAsTrainer;
  const tabs =
    people && people.length > 1
      ? people.map((person) => ({
          key: person.workout.id,
          label: person.userId === userId ? 'You' : firstName(person.displayName),
          icon: 'user' as const,
        }))
      : null;

  // The workout as a whole, from the sets that were actually logged -- each holding what its
  // exercise records (weight and reps; reps; a time).
  const loggedByExercise = shown.exercises.map((exercise) => {
    const type = measurementTypeOf(exercise);
    return { exercise, type, sets: loggedSets(exercise.sets, type) };
  });
  // Volume is weight x reps: weighted exercises only.
  const weightedLogged = loggedByExercise
    .filter((entry) => entry.type === 'weight_reps')
    .flatMap((entry) => completedSetsOnly(entry.sets));
  const totalVolume = volumeInUnit(weightedLogged, weightUnit);
  const loggedSetCount = loggedByExercise.reduce((sum, entry) => sum + entry.sets.length, 0);
  const durationMinutes = computeDurationMinutes(shown.performedAt, shown.completedAt);
  const isRecord = (exerciseId: string, type: MeasurementType, set: SetRecord) =>
    !isOwn
      ? false
      : type === 'weight_reps'
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
    new Set(shown.exercises.map((e) => MUSCLE_GROUP_LABELS[e.muscleGroup])),
  ).join(' • ');
  // One tab per primary muscle group the workout trained, in the order they were first done --
  // all of them from the start, since it's done. Another person's workout in a group has its own;
  // a tab they didn't train shows All.
  const muscleTabs = workoutMuscleTabs(shown.exercises);
  const activeTab: MuscleTab =
    muscleTab !== 'all' && muscleTabs.includes(muscleTab) ? muscleTab : 'all';
  const shownExercises = loggedByExercise.filter(
    ({ exercise }) => activeTab === 'all' || exercise.muscleGroup === activeTab,
  );

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
            canEdit
              ? {
                  icon: 'edit-2',
                  onPress: () =>
                    navigation.navigate(
                      'EditWorkout',
                      editsAsTrainer
                        ? {
                            workoutId: shown.id,
                            clientId: shownPerson.userId,
                            clientName: shownPerson.displayName ?? undefined,
                          }
                        : { workoutId, clientId, clientName },
                    ),
                  accessibilityLabel: editsAsTrainer
                    ? `Edit ${firstName(shownPerson.displayName)}'s workout`
                    : 'Edit workout',
                  testID: 'workout-detail-edit',
                }
              : undefined
          }
          rightAction2={
            isOwn && workout.completedAt && !clientId && loggedSetCount > 0
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
      {tabs ? (
        <UnderlineTabs
          testID="workout-detail-people"
          categories={tabs}
          active={shown.id}
          onSelect={setSelectedId}
          accentColor={theme.accent}
        />
      ) : null}

      <AppCard hero topAccent={theme.accent} testID="workout-detail-summary">
        {!isOwn ? (
          <Text testID="workout-detail-person-workout" style={styles.exerciseTitle}>
            {shown.name}
          </Text>
        ) : null}
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
            {isOwn ? (
              <StatBlock
                testID="workout-detail-stat-records"
                value={String(recordCount)}
                label={recordCount === 1 ? 'Record' : 'Records'}
                valueColor={recordCount > 0 ? theme.accent : undefined}
              />
            ) : (
              <StatBlock
                testID="workout-detail-stat-exercises"
                value={String(loggedByExercise.filter((entry) => entry.sets.length > 0).length)}
                label="Exercises"
              />
            )}
          </View>
        </View>
      </AppCard>

      {muscleTabs.length > 0 ? (
        <FilterChips<MuscleTab>
          testID="workout-detail-muscle-tabs"
          options={[
            { value: 'all', label: 'All' },
            ...muscleTabs.map((muscle) => ({ value: muscle, label: MUSCLE_GROUP_LABELS[muscle] })),
          ]}
          value={activeTab}
          onChange={setMuscleTab}
          accentColor={theme.accent}
          onAccentColor={theme.onAccent}
        />
      ) : null}

      {shownExercises.map(({ exercise, type, sets: exerciseSets }) => {
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
              disabled={type !== 'weight_reps' || !isOwn}
              accessibilityRole={type === 'weight_reps' && isOwn ? 'button' : undefined}
              accessibilityLabel={
                type === 'weight_reps' && isOwn
                  ? `${exercise.exerciseName}, view PR history`
                  : undefined
              }
            >
              {/* Which machine it was, as the Exercise Library shows it: its photo (full size
                  on a tap -- the row's own tap still opens PR History), then its muscle, gym
                  and handle. */}
              <ExercisePhoto
                testID={`exercise-photo-${exercise.id}`}
                uri={exercise.photoUrl}
                name={exercise.exerciseName}
              />
              <View style={styles.exerciseTitleBody}>
                <Text style={styles.exerciseTitle}>{exercise.exerciseName}</Text>
                <Text testID={`exercise-muscle-${exercise.id}`} style={styles.exerciseMuscle}>
                  {machineLine(exercise, MUSCLE_GROUP_LABELS[exercise.muscleGroup])}
                </Text>
              </View>
              {type === 'weight_reps' && isOwn ? (
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

      {isOwn ? (
        <TextButton
          testID="workout-detail-delete"
          label="Delete Workout"
          destructive
          onPress={confirmDeleteWorkout}
        />
      ) : null}
    </Screen>
  );
}
