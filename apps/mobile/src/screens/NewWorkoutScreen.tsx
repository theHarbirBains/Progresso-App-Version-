import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { colors } from '../design/theme';
import { EmptyState } from '../design/EmptyState';
import { LoadingState } from '../design/LoadingState';
import { SectionHeader } from '../design/SectionHeader';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import { getMyProfile } from '../lib/api';
import { roundWeight, toKg } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { AddExerciseButton } from '../workouts/AddExerciseButton';
import { CreateCustomExerciseButton } from '../workouts/CreateCustomExerciseButton';
import { ExerciseCard } from '../workouts/ExerciseCard';
import { ExercisePickerModal } from '../workouts/ExercisePickerModal';
import { computeNextWorkout } from '../workouts/nextWorkout';
import {
  addExerciseToWorkout,
  createSet,
  createWorkout,
  updateSet,
  type WorkoutSummary,
} from '../workouts/workoutQueries';
import {
  fetchLastWorkoutSplitDayId,
  fetchWorkoutSplitDetail,
  type WorkoutSplitDetail,
} from '../workouts/workoutSplitQueries';
import { WorkoutHeader } from '../workouts/WorkoutHeader';
import { WorkoutSummaryCard } from '../workouts/WorkoutSummaryCard';
import { ExerciseFormScreen } from './ExerciseFormScreen';
import { liveWorkoutStyles as styles } from './liveWorkoutStyles';

type Props = RootStackScreenProps<'NewWorkout'>;

interface LocalSetDraft {
  weight: string;
  reps: string;
  completed: boolean;
}

function isValidDraft(draft: LocalSetDraft | undefined): boolean {
  if (!draft) return false;
  const weightNum = Number(draft.weight);
  const repsNum = Number(draft.reps);
  return Number.isFinite(weightNum) && weightNum > 0 && Number.isInteger(repsNum) && repsNum > 0;
}

// The planning half of the Start Workout experience (see
// ActiveWorkoutScreen.tsx for the live-tracking half). Exercises and their
// planned sets exist only in local state until "Start Workout" is pressed --
// the workout, its exercises, and every set are all created then, in their
// final order, exactly matching the pre-existing "local draft before
// persistence" pattern this screen already used for exercise selection
// (now extended to each exercise's planned set count/values too). Any set
// the user already filled in during planning is persisted already-complete;
// anything left blank is created blank, ready for live logging.
export function NewWorkoutScreen({ navigation }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const { theme, weightUnit } = useProgressTheme();

  const [name, setName] = useState('');
  const [selected, setSelected] = useState<ExerciseRow[]>([]);
  const [localSets, setLocalSets] = useState<Record<string, LocalSetDraft[]>>({});

  const [pickerOpen, setPickerOpen] = useState(false);
  const [customExerciseOpen, setCustomExerciseOpen] = useState(false);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<WorkoutSummary | null>(null);

  const [activeSplit, setActiveSplit] = useState<WorkoutSplitDetail | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [splitLoading, setSplitLoading] = useState(true);
  // Distinct from activeSplit itself: a user WITH an active split id whose
  // detail momentarily fails to load should still be able to start a
  // plain (day-less) workout, per the existing non-critical-failure
  // behavior below -- only a genuinely absent activeWorkoutSplitId blocks
  // tracking entirely (see the render below).
  const [hasActiveSplitId, setHasActiveSplitId] = useState(false);

  // A user MUST have an active split before they can track a workout --
  // re-checked on every focus (not just mount) so returning here after
  // picking one in ChooseWorkoutSplitScreen immediately unblocks this
  // screen. Failures loading the split's *detail* are non-critical: the
  // screen just falls back to the plain (day-less) experience rather than
  // blocking workout creation, since the user does have an active split.
  useEffect(() => {
    if (!userId || !accessToken) return;
    let cancelled = false;
    async function loadActiveSplit() {
      setSplitLoading(true);
      try {
        const profile = await getMyProfile(accessToken!);
        if (cancelled) return;
        if (!profile.activeWorkoutSplitId) {
          setHasActiveSplitId(false);
          return;
        }
        setHasActiveSplitId(true);
        const [detail, lastDayId] = await Promise.all([
          fetchWorkoutSplitDetail(profile.activeWorkoutSplitId),
          fetchLastWorkoutSplitDayId(userId),
        ]);
        if (cancelled) return;
        setActiveSplit(detail);
        const plan = computeNextWorkout(detail, lastDayId);
        if (plan) {
          setSelectedDayId(plan.day.id);
          setName(plan.day.name);
        }
      } catch {
        // Non-critical -- see comment above.
      } finally {
        if (!cancelled) setSplitLoading(false);
      }
    }
    const unsubscribe = navigation.addListener('focus', loadActiveSplit);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId, accessToken, navigation]);

  function selectDay(dayId: string, dayName: string) {
    setSelectedDayId(dayId);
    setName(dayName);
  }

  function addToSelection(exercise: ExerciseRow) {
    setPickerOpen(false);
    setSelected((prev) => (prev.some((e) => e.id === exercise.id) ? prev : [...prev, exercise]));
    setLocalSets((prev) =>
      prev[exercise.id]
        ? prev
        : { ...prev, [exercise.id]: [{ weight: '', reps: '', completed: false }] },
    );
  }

  function removeFromSelection(exerciseId: string) {
    setSelected((prev) => prev.filter((e) => e.id !== exerciseId));
    setLocalSets((prev) => {
      const next = { ...prev };
      delete next[exerciseId];
      return next;
    });
  }

  function moveSelection(index: number, direction: -1 | 1) {
    setSelected((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleAddLocalSet(exerciseId: string) {
    setLocalSets((prev) => ({
      ...prev,
      [exerciseId]: [...(prev[exerciseId] ?? []), { weight: '', reps: '', completed: false }],
    }));
  }

  function handleChangeLocalWeight(exerciseId: string, index: number, text: string) {
    setLocalSets((prev) => {
      const drafts = [...(prev[exerciseId] ?? [])];
      if (!drafts[index]) return prev;
      drafts[index] = { ...drafts[index], weight: text };
      return { ...prev, [exerciseId]: drafts };
    });
  }

  function handleChangeLocalReps(exerciseId: string, index: number, text: string) {
    setLocalSets((prev) => {
      const drafts = [...(prev[exerciseId] ?? [])];
      if (!drafts[index]) return prev;
      drafts[index] = { ...drafts[index], reps: text };
      return { ...prev, [exerciseId]: drafts };
    });
  }

  function handleToggleLocalComplete(exerciseId: string, index: number) {
    setLocalSets((prev) => {
      const drafts = [...(prev[exerciseId] ?? [])];
      const draft = drafts[index];
      if (!draft) return prev;
      if (!draft.completed && !isValidDraft(draft)) return prev;
      drafts[index] = { ...draft, completed: !draft.completed };
      return { ...prev, [exerciseId]: drafts };
    });
  }

  async function handleStart() {
    if (!userId || !accessToken || !name.trim() || selected.length === 0 || starting) return;
    setError(null);
    setConflict(null);
    setStarting(true);
    try {
      const result = await createWorkout(userId, name.trim(), selectedDayId ?? undefined);
      if (result.type === 'conflict') {
        setConflict(result.existingWorkout);
        return;
      }
      for (let i = 0; i < selected.length; i++) {
        const exercise = selected[i];
        const workoutExerciseId = await addExerciseToWorkout(result.workout.id, exercise.id, i + 1);
        const drafts = localSets[exercise.id] ?? [{ weight: '', reps: '', completed: false }];
        for (let s = 0; s < drafts.length; s++) {
          const draft = drafts[s];
          const created = await createSet(workoutExerciseId, s + 1);
          if (isValidDraft(draft)) {
            await updateSet(created.id, {
              weightKg: roundWeight(toKg(Number(draft.weight), weightUnit)),
              reps: Math.trunc(Number(draft.reps)),
              completedAt: new Date().toISOString(),
            });
          }
        }
      }
      navigation.replace('ActiveWorkout', { workoutId: result.workout.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start workout');
    } finally {
      setStarting(false);
    }
  }

  const canStart = name.trim().length > 0 && selected.length > 0 && !starting;
  const muscleGroupsLabel = Array.from(
    new Set(selected.map((e) => MUSCLE_GROUP_LABELS[e.muscleGroup])),
  ).join(', ');
  const totalSets = selected.reduce((sum, e) => sum + (localSets[e.id]?.length ?? 1), 0);

  // The header (with its Back button) stays immediately available in every
  // state -- only the body below it changes -- so backing out never has to
  // wait on the split check.
  if (splitLoading) {
    return (
      <View style={styles.screen}>
        <WorkoutHeader title="Start Workout" onBack={() => navigation.goBack()} />
        <LoadingState testID="new-workout-loading" />
      </View>
    );
  }

  // A user must select a workout split before they can track a workout --
  // no exceptions, no "skip this" escape hatch.
  if (!hasActiveSplitId) {
    return (
      <View style={styles.screen}>
        <WorkoutHeader title="Start Workout" onBack={() => navigation.goBack()} />
        <View style={styles.emptyExercisesWrap}>
          <EmptyState
            testID="new-workout-no-split"
            icon={<Feather name="layers" size={24} color={colors.textMuted} />}
            title="Choose Your Workout Split"
          />
          <TouchableOpacity
            testID="new-workout-choose-split"
            style={[styles.startButton, { backgroundColor: theme.accent, marginHorizontal: 24 }]}
            onPress={() => navigation.navigate('ChooseWorkoutSplit')}
          >
            <Text style={[styles.startButtonText, { color: theme.onAccent }]}>
              Choose Your Workout Split
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <WorkoutHeader title="Start Workout" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {error ? (
          <Text testID="new-workout-error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        {activeSplit && activeSplit.days.length > 0 ? (
          <View testID="new-workout-split-days" style={{ marginBottom: 12 }}>
            <SectionHeader label="Which day are you training?" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {activeSplit.days.map((day) => {
                const isSelected = day.id === selectedDayId;
                return (
                  <TouchableOpacity
                    key={day.id}
                    testID={`new-workout-day-${day.id}`}
                    style={[
                      styles.addExerciseButton,
                      { flex: undefined, paddingHorizontal: 16 },
                      isSelected && { borderColor: theme.accent, backgroundColor: theme.accentBg },
                    ]}
                    onPress={() => selectDay(day.id, day.name)}
                  >
                    <Text
                      style={[styles.addExerciseButtonText, isSelected && { color: theme.accent }]}
                    >
                      {day.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        <TextInput
          testID="new-workout-name"
          style={styles.searchInput}
          placeholder="Workout name"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <WorkoutSummaryCard
          testID="new-workout-summary"
          workoutName={name || 'New Workout'}
          muscleGroupsLabel={muscleGroupsLabel}
          performedAt={null}
          active={false}
          totalSets={totalSets}
          totalVolumeDisplay={`0 ${weightUnit}`}
          accentColor={theme.accent}
        />

        {conflict ? (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.errorText}>
              You already have an active workout: &quot;{conflict.name}&quot;
            </Text>
            <TouchableOpacity
              testID="resume-instead"
              style={[styles.startButton, { backgroundColor: theme.accent }]}
              onPress={() => navigation.replace('ActiveWorkout', { workoutId: conflict.id })}
            >
              <Text style={[styles.startButtonText, { color: theme.onAccent }]}>
                Resume It Instead
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          testID="start-workout"
          style={[
            styles.startButton,
            { backgroundColor: theme.accent },
            !canStart && styles.startButtonDisabled,
          ]}
          onPress={handleStart}
          disabled={!canStart}
        >
          <Text style={[styles.startButtonText, { color: theme.onAccent }]}>
            {starting ? 'Starting...' : 'Start Workout'}
          </Text>
        </TouchableOpacity>

        <View style={styles.sectionTitle}>
          <SectionHeader label="Exercises" />
        </View>

        <View style={styles.addExerciseRow}>
          <AddExerciseButton
            testID="new-workout-add-exercise"
            onPress={() => setPickerOpen(true)}
          />
          <CreateCustomExerciseButton
            testID="new-workout-create-custom"
            onPress={() => setCustomExerciseOpen(true)}
          />
        </View>

        {selected.map((exercise, index) => {
          const drafts = localSets[exercise.id] ?? [{ weight: '', reps: '', completed: false }];
          return (
            <ExerciseCard
              key={exercise.id}
              testID={`exercise-card-${exercise.id}`}
              exerciseName={exercise.name}
              muscleGroup={exercise.muscleGroup}
              sets={drafts.map((draft, i) => ({
                id: `${exercise.id}-${i}`,
                setIndex: i + 1,
                weight: draft.weight,
                reps: draft.reps,
                completed: draft.completed,
                canComplete: isValidDraft(draft),
              }))}
              onChangeWeight={(setId, text) => {
                const i = Number(setId.split('-').pop());
                handleChangeLocalWeight(exercise.id, i, text);
              }}
              onChangeReps={(setId, text) => {
                const i = Number(setId.split('-').pop());
                handleChangeLocalReps(exercise.id, i, text);
              }}
              onToggleComplete={(setId) => {
                const i = Number(setId.split('-').pop());
                handleToggleLocalComplete(exercise.id, i);
              }}
              onAddSet={() => handleAddLocalSet(exercise.id)}
              onRemoveExercise={() => removeFromSelection(exercise.id)}
              onMoveUp={index > 0 ? () => moveSelection(index, -1) : undefined}
              onMoveDown={index < selected.length - 1 ? () => moveSelection(index, 1) : undefined}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
          );
        })}
      </ScrollView>

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addToSelection}
        userId={userId}
        alreadyAddedIds={selected.map((e) => e.id)}
      />

      {customExerciseOpen ? (
        <ExerciseFormScreen
          mode="create"
          onDone={() => {
            setCustomExerciseOpen(false);
            setPickerOpen(true);
          }}
          onCancel={() => setCustomExerciseOpen(false)}
        />
      ) : null}
    </View>
  );
}
