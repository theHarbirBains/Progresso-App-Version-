import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Alert, Modal, StyleSheet, View } from 'react-native';
import { Card } from '../design/Card';
import { FilterChips } from '../design/FilterChips';
import { RiseInStack } from '../design/RiseIn';
import { EmptyState } from '../design/EmptyState';
import { LoadingState } from '../design/LoadingState';
import { Text } from '../design/Text';
import { UnderlineTabs } from '../design/UnderlineTabs';
import { colors, typeScale, widgetGap } from '../design/theme';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import { measurementTypeOf, type MeasurementType } from '../exercises/movementTypes';
import { computeTotalSets } from './workoutSummary';
import { WorkoutStats } from './WorkoutStats';
import { useProgressTheme } from '../progress/useProgressTheme';
import { AddExerciseButton } from './AddExerciseButton';
import { CreateCustomExerciseButton } from './CreateCustomExerciseButton';
import { ExerciseFormScreen } from '../screens/ExerciseFormScreen';
import {
  loadLiveWorkoutDraft,
  mergeLiveWorkoutDrafts,
  pendingDraftsFor,
  saveLiveWorkoutDraft,
} from './liveWorkoutDraft';
import { ExerciseCard, type PreviousSessionDisplay } from './ExerciseCard';
import { ExercisePickerModal } from './ExercisePickerModal';
import type { PreviousExercisesState } from './usePreviousExercises';
import {
  buildPreviousSessionDisplay,
  computeCardSets,
  computeUnilateralSets,
  draftFromSet,
  groupUnilateralSets,
  hasDraftInput,
  isValidDraft,
  type SetInputDraft,
} from './setInputDrafts';
import { dropSetSlot, rowsRemovedWith, setLabels, type DropSetRow } from './dropSets';
import { useWarmupHint } from './WarmupHint';
import { LiveProgressionSheets, RepRangeRow, useLiveProgression } from './useLiveProgression';
import { useSetInputDrafts } from './useSetInputDrafts';
import { useSetAutosave, type LiveSet } from './useSetAutosave';
import { discardSetTimer } from './setTimers';
import { workoutMuscleTabs, type MuscleTab } from './workoutMuscleTabs';
import {
  addExerciseToWorkout,
  createSet,
  deleteSet,
  fetchNextExerciseOrderIndex,
  fetchPreviousPerformance,
  fetchWorkoutDetail,
  moveSets,
  removeExerciseFromWorkout,
  updateSet,
  type SetRecord,
  type WorkoutDetail,
  type WorkoutExerciseWithSets,
} from './workoutQueries';

/** One person in the group and the workout that is theirs. */
export interface GroupWorkoutMember {
  userId: string;
  displayName: string | null;
  workoutId: string;
}

/** What the screen around the editor calls on its Finish button (see useSetAutosave). */
export interface LiveWorkoutFinish {
  /** Stops timers, asks about sets left empty and saves the rest; resolves whether to finish. */
  readyToFinish: () => Promise<boolean>;
}

interface Props {
  members: GroupWorkoutMember[];
  /** Filled in with the editor's Finish step, for the screen's Finish button to call first. */
  finishRef?: MutableRefObject<LiveWorkoutFinish | null>;
  /**
   * Turns a picked exercise into the one this workout should use. A trainer's live session
   * needs the client's copy of the trainer's own exercises. Groups do not pass it.
   */
  resolveExerciseId?: (exerciseId: string) => Promise<string>;
  /** When the group started: the stats strip counts the workout from here, as Active Workout does. */
  startedAt: string;
  /** The signed-in person: their tab reads "You", and their exercise library is the picker's. */
  userId: string;
  accentColor: string;
  onAccentColor: string;
  /** The signed-in person's previous exercises, listed first in Add Exercise (usePreviousExercises). */
  previousExercises?: PreviousExercisesState;
  /**
   * Warm-ups and drop sets, as in Active Workout: a set's number tapped marks it a warm-up, and
   * Drop Set adds a drop under the last set filled in -- on any person's tab, for that person's
   * sets. A group workout offers them; a trainer's live session doesn't yet.
   */
  warmupsAndDrops?: boolean;
  testID?: string;
}

/**
 * A group's live workout, laid out like the regular Active Workout. A tab per person
 * across the top; the exercises are the group's, so adding or removing one changes
 * every person's workout. Only the sets differ: the tab shows that person's own sets,
 * with the weight lifted and reps done, and anyone in the group can enter them. When the
 * group finishes, each person keeps only the exercises they did (the API's GroupsService.finish
 * takes the rest off their workout).
 *
 * With `warmupsAndDrops` (a group workout), any person's sets can be marked warm-ups and have drop
 * sets added, exactly as in Active Workout.
 *
 * The signed-in person's own tab also has everything Active Workout shows from their own
 * records and settings (useLiveProgression): their rep range under the stats, and each
 * exercise's All-Time Best, the suggestion and its own range. Other people's tabs don't --
 * those come from records only their owner can read.
 */
export function GroupWorkoutEditor({
  members,
  finishRef,
  resolveExerciseId,
  startedAt,
  userId,
  accentColor,
  onAccentColor,
  previousExercises,
  warmupsAndDrops = false,
  testID = 'group-workout',
}: Props) {
  const { weightUnit } = useProgressTheme();
  const [details, setDetails] = useState<Record<string, WorkoutDetail>>({});
  const [selectedId, setSelectedId] = useState(userId);
  const { setInputs, setSetInputs, changeWeight, changeReps, changeDuration } = useSetInputDrafts();
  const [previous, setPrevious] = useState<
    Record<string, { performedAt: string; sets: SetRecord[] }>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  // The muscle tab showing: every exercise, or one primary muscle group's (as Active Workout).
  const [muscleTab, setMuscleTab] = useState<MuscleTab>('all');
  const progression = useLiveProgression({ userId, weightUnit, onError: setError });
  // The latest workouts and typed values, for handlers an ExerciseCard may hold from an earlier
  // render (its memo compares only whether they're given).
  const detailsRef = useRef(details);
  detailsRef.current = details;
  const setInputsRef = useRef(setInputs);
  setInputsRef.current = setInputs;
  // The one-time tip on how to mark a warm-up, on the first exercise shown (WarmupHint.tsx).
  const { show: showWarmupHint, dismiss: dismissWarmupHint } = useWarmupHint();
  const warmupHint = useMemo(() => ({ onDismiss: dismissWarmupHint }), [dismissWarmupHint]);

  // Every person's sets save as they're typed, whoever types them -- see useSetAutosave.
  const liveSets: LiveSet[] = useMemo(
    () =>
      Object.values(details).flatMap((detail) =>
        detail.exercises.flatMap((exercise) =>
          exercise.sets.map((set) => ({
            set,
            type: measurementTypeOf(exercise),
            exerciseId: exercise.id,
            unilateral: exercise.movementType === 'unilateral',
          })),
        ),
      ),
    [details],
  );
  const withSets =
    (
      change: (sets: SetRecord[]) => SetRecord[],
    ): ((prev: Record<string, WorkoutDetail>) => Record<string, WorkoutDetail>) =>
    (prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([memberId, detail]) => [
          memberId,
          {
            ...detail,
            exercises: detail.exercises.map((exercise) => ({
              ...exercise,
              sets: change(exercise.sets),
            })),
          },
        ]),
      );
  /** Deletes sets and forgets them: their inputs and any timer. */
  async function removeSetRows(setIds: string[]) {
    await Promise.all(setIds.map((setId) => deleteSet(setId)));
    const gone = new Set(setIds);
    setDetails(withSets((sets) => sets.filter((set) => !gone.has(set.id))));
    setSetInputs((prev) => {
      const next = { ...prev };
      for (const setId of setIds) delete next[setId];
      return next;
    });
    for (const setId of setIds) discardSetTimer(setId);
  }
  const autosave = useSetAutosave({
    sets: liveSets,
    setInputs,
    weightUnit,
    save: (setId, update) => updateSet(setId, update),
    onSaved: (saved) =>
      setDetails(withSets((sets) => sets.map((set) => (set.id === saved.id ? saved : set)))),
    remove: removeSetRows,
    onTimersStopped: (drafts) => setSetInputs((prev) => ({ ...prev, ...drafts })),
    onError: setError,
  });
  useEffect(() => {
    if (!finishRef) return;
    finishRef.current = { readyToFinish: autosave.readyToFinish };
    return () => {
      finishRef.current = null;
    };
  }, [finishRef, autosave.readyToFinish]);

  const memberKey = members.map((m) => `${m.userId}:${m.workoutId}`).join('|');

  /** Loads one person's workout and seeds their set inputs without overwriting open drafts. */
  const loadMember = useCallback(
    async (member: GroupWorkoutMember) => {
      const detail = await fetchWorkoutDetail(member.workoutId);
      // Values typed into open sets before the app closed or crashed are read back here.
      const drafts = await loadLiveWorkoutDraft(member.workoutId);
      setDetails((prev) => ({ ...prev, [member.userId]: detail }));
      const openSetIds = new Set(
        detail.exercises.flatMap((ex) =>
          ex.sets.filter((set) => set.completedAt === null).map((set) => set.id),
        ),
      );
      const saved: Record<string, SetInputDraft> = {};
      for (const exercise of detail.exercises) {
        for (const set of exercise.sets) {
          saved[set.id] = draftFromSet(set, measurementTypeOf(exercise), weightUnit);
        }
      }
      const merged = mergeLiveWorkoutDrafts(saved, drafts, openSetIds);
      setSetInputs((prev) => {
        const next = { ...prev };
        for (const [setId, value] of Object.entries(merged)) {
          // Saved sets always take the server's value; an open set keeps what is typed in it now.
          if (!openSetIds.has(setId) || next[setId] === undefined) next[setId] = value;
        }
        return next;
      });
      return detail;
      // setSetInputs is useSetInputDrafts' own useState setter (stable for the life of the
      // screen); listed for the linter, not because it ever actually changes.
    },
    [weightUnit, setSetInputs],
  );

  /**
   * Loads everyone, then makes sure each person has every exercise the group has. An
   * exercise someone is missing (added before they joined) is added to their workout.
   */
  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const loaded = await Promise.all(members.map((m) => loadMember(m)));
      const byExercise = new Map<string, WorkoutExerciseWithSets>();
      loaded.forEach((detail) => {
        for (const exercise of detail.exercises) {
          if (!byExercise.has(exercise.exerciseId)) byExercise.set(exercise.exerciseId, exercise);
        }
      });
      let added = false;
      for (let i = 0; i < members.length; i += 1) {
        const have = new Set(loaded[i].exercises.map((ex) => ex.exerciseId));
        for (const [exerciseId, shape] of byExercise) {
          if (have.has(exerciseId)) continue;
          await addToWorkout(members[i], exerciseId, shape);
          added = true;
        }
      }
      if (added) await Promise.all(members.map((m) => loadMember(m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the group workout');
    } finally {
      setLoading(false);
    }
    // members is tracked through memberKey so a new member loads without a re-render loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberKey, loadMember]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // One exercise into one workout: the next order, then its first set (both sides if
  // unilateral), empty -- never filled in from that person's last session. The next order
  // comes from every order index that workout has ever used, not just its currently visible
  // exercises -- a removed one still holds its slot (see fetchNextExerciseOrderIndex).
  async function addToWorkout(
    member: GroupWorkoutMember,
    exerciseId: string,
    shape: {
      movementType: WorkoutExerciseWithSets['movementType'];
      measurementType?: MeasurementType;
    },
  ) {
    const { movementType } = shape;
    const order = await fetchNextExerciseOrderIndex(member.workoutId);
    const workoutExerciseId = await addExerciseToWorkout(member.workoutId, exerciseId, order);
    if (movementType === 'unilateral') {
      await createSet(workoutExerciseId, 1, 'left');
      await createSet(workoutExerciseId, 1, 'right');
    } else {
      await createSet(workoutExerciseId, 1);
    }
  }

  /** Runs one change, then reloads so each row shows what is saved. */
  async function change(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await Promise.all(members.map((m) => loadMember(m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That change did not save');
    }
  }

  // The group's exercises, in the order the first person has them, one entry per exercise.
  const exercises = useMemo(() => {
    const seen = new Map<string, WorkoutExerciseWithSets>();
    for (const member of members) {
      const detail = details[member.userId];
      if (!detail) continue;
      for (const exercise of [...detail.exercises].sort((a, b) => a.orderIndex - b.orderIndex)) {
        if (!seen.has(exercise.exerciseId)) seen.set(exercise.exerciseId, exercise);
      }
    }
    return Array.from(seen.values());
  }, [members, details]);

  const selected = members.find((m) => m.userId === selectedId) ?? members[0];
  const selectedDetail = selected ? details[selected.userId] : undefined;
  // Primitives for the previous-session effect, so it reruns only when the tab or its exercises change.
  const selectedMember = selected;
  const selectedExerciseIds = selectedDetail
    ? selectedDetail.exercises.map((ex) => ex.exerciseId).join(',')
    : '';

  /** The selected person's row for one of the group's exercises. */
  function rowFor(exerciseId: string): WorkoutExerciseWithSets | undefined {
    return selectedDetail?.exercises.find((ex) => ex.exerciseId === exerciseId);
  }

  // Last completed session for each exercise, for the person whose tab is open.
  useEffect(() => {
    if (!selectedMember || selectedExerciseIds === '') return;
    let cancelled = false;
    const member = selectedMember;
    const exerciseIds = selectedExerciseIds.split(',');
    void (async () => {
      const entries = await Promise.all(
        exerciseIds.map(async (exerciseId) => {
          const key = `${member.userId}:${exerciseId}`;
          try {
            const result = await fetchPreviousPerformance(
              member.userId,
              exerciseId,
              member.workoutId,
            );
            return [key, result] as const;
          } catch {
            return [key, null] as const;
          }
        }),
      );
      if (cancelled) return;
      setPrevious((prev) => {
        const next = { ...prev };
        for (const [key, result] of entries) {
          if (result && result.sets.length > 0) next[key] = result;
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedMember, selectedExerciseIds]);

  useEffect(() => {
    const timer = setTimeout(() => {
      for (const member of members) {
        const detail = details[member.userId];
        if (!detail) continue;
        const openSetIds = new Set(
          detail.exercises.flatMap((ex) =>
            ex.sets.filter((set) => set.completedAt === null).map((set) => set.id),
          ),
        );
        void saveLiveWorkoutDraft(member.workoutId, pendingDraftsFor(setInputs, openSetIds));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [setInputs, details, members]);

  async function addExercise(exercise: ExerciseRow) {
    setPickerOpen(false);
    // On a muscle tab, the new exercise's own tab, so it's never added out of sight.
    setMuscleTab((tab) => (tab === 'all' ? tab : exercise.muscleGroup));
    await change(async () => {
      for (const member of members) {
        const detail = details[member.userId];
        if (!detail) continue;
        const exerciseId = resolveExerciseId ? await resolveExerciseId(exercise.id) : exercise.id;
        await addToWorkout(member, exerciseId, exercise);
      }
    });
  }

  async function removeExercise(exerciseId: string) {
    await change(async () => {
      for (const member of members) {
        const row = details[member.userId]?.exercises.find((ex) => ex.exerciseId === exerciseId);
        if (row) await removeExerciseFromWorkout(row.id);
      }
    });
  }

  async function addSet(exercise: WorkoutExerciseWithSets) {
    if (!selected) return;
    const nextIndex = exercise.sets.reduce((max, s) => Math.max(max, s.setIndex), 0) + 1;
    await change(async () => {
      if (exercise.movementType === 'unilateral') {
        await createSet(exercise.id, nextIndex, 'left');
        await createSet(exercise.id, nextIndex, 'right');
      } else {
        await createSet(exercise.id, nextIndex);
      }
    });
  }

  /**
   * Removes one of the shown person's sets -- a unilateral set's two sides together. An empty set
   * goes straight away; one with numbers in it, or done, is asked about first, as in Active
   * Workout, so a stray tap never loses a logged set.
   */
  function removeSet(setId: string) {
    const exercise = selectedDetail?.exercises.find((ex) =>
      ex.sets.some((set) => set.id === setId),
    );
    const set = exercise?.sets.find((candidate) => candidate.id === setId);
    if (!exercise || !set) return;
    // The exercise's sets in order, a unilateral set's two sides together; a working set goes
    // with the drop sets under it -- they're part of it.
    const logical = Array.from(new Set(exercise.sets.map((row) => row.setIndex)))
      .sort((a, b) => a - b)
      .map((setIndex) => exercise.sets.filter((row) => row.setIndex === setIndex));
    const position = logical.findIndex((group) => group.some((row) => row.id === setId));
    const groups = rowsRemovedWith(
      logical.map((group) => ({ rows: group, isDrop: group[0].isDrop })),
      position,
    );
    const rows = groups.flatMap((group) => group.rows);
    const remove = () =>
      void removeSetRows(rows.map((row) => row.id)).catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to remove set'),
      );
    const hasData = rows.some(
      (row) => row.completedAt !== null || hasDraftInput(setInputs[row.id]),
    );
    if (!hasData) {
      remove();
      return;
    }
    const label = setLabels(logical.map((group) => ({ isDrop: group[0].isDrop })))[position];
    const workingSets = logical.filter((group) => !group[0].isDrop).length;
    const withDrops = groups.length > 1;
    Alert.alert(
      label.drop
        ? 'Remove this drop set?'
        : withDrops
          ? `Remove set ${label.number} and its drop sets?`
          : `Remove set ${label.number}?`,
      !label.drop && workingSets === 1
        ? `It's the only set of ${exercise.exerciseName}. The exercise stays in the workout, so a set can be added again.`
        : `What was entered for ${withDrops ? 'them' : 'it'} is removed from this workout.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove Set', style: 'destructive', onPress: remove },
      ],
    );
  }

  /** The workout exercise a set belongs to, from the latest workouts, whoever's it is. */
  function exerciseHolding(setId: string): WorkoutExerciseWithSets | undefined {
    for (const detail of Object.values(detailsRef.current)) {
      const exercise = detail.exercises.find((ex) => ex.sets.some((set) => set.id === setId));
      if (exercise) return exercise;
    }
    return undefined;
  }

  /**
   * Tapping a set's number marks it a warm-up (or a working set again): shown at once, saved
   * straight away, put back if the save fails. A unilateral set's two sides go together.
   */
  function toggleWarmup(setId: string) {
    // Marked once, the tip on how has done its job.
    dismissWarmupHint();
    const exercise = exerciseHolding(setId);
    const set = exercise?.sets.find((candidate) => candidate.id === setId);
    if (!exercise || !set) return;
    const rows =
      exercise.movementType === 'unilateral'
        ? exercise.sets.filter((candidate) => candidate.setIndex === set.setIndex)
        : [set];
    const ids = new Set(rows.map((row) => row.id));
    const next = !set.isWarmup;
    const mark = (value: boolean) =>
      setDetails(
        withSets((sets) =>
          sets.map((candidate) =>
            ids.has(candidate.id) ? { ...candidate, isWarmup: value } : candidate,
          ),
        ),
      );
    mark(next);
    void Promise.all(rows.map((row) => updateSet(row.id, { isWarmup: next }))).catch(
      (err: unknown) => {
        mark(!next);
        setError(err instanceof Error ? err.message : 'Failed to mark the warm-up');
      },
    );
  }

  /**
   * Drop Set: a drop under the last set filled in (and any drops already under it) -- a
   * unilateral exercise's two sides together. A set waiting below moves down one to make room,
   * on the server first (moveSets, all at once); then everyone's workout is read again.
   */
  async function addDropSet(workoutExerciseId: string) {
    const exercise = Object.values(detailsRef.current)
      .flatMap((detail) => detail.exercises)
      .find((ex) => ex.id === workoutExerciseId);
    if (!exercise) return;
    const type = measurementTypeOf(exercise);
    const filled = (set: SetRecord) =>
      set.completedAt !== null || isValidDraft(setInputsRef.current[set.id], type);
    const rows: DropSetRow[] =
      exercise.movementType === 'unilateral'
        ? groupUnilateralSets(exercise.sets).map(({ setIndex, left, right }) => ({
            setIndex,
            ids: [left.id, right.id],
            isWarmup: left.isWarmup,
            isDrop: left.isDrop,
            filled: filled(left) && filled(right),
          }))
        : [...exercise.sets]
            .sort((a, b) => a.setIndex - b.setIndex)
            .map((set) => ({
              setIndex: set.setIndex,
              ids: [set.id],
              isWarmup: set.isWarmup,
              isDrop: set.isDrop,
              filled: filled(set),
            }));
    const slot = dropSetSlot(rows);
    if (!slot) return;
    await change(async () => {
      await moveSets(slot.moves);
      if (exercise.movementType === 'unilateral') {
        await createSet(exercise.id, slot.setIndex, 'left', { isDrop: true });
        await createSet(exercise.id, slot.setIndex, 'right', { isDrop: true });
      } else {
        await createSet(exercise.id, slot.setIndex, undefined, { isDrop: true });
      }
    });
  }

  function confirmRemove(exercise: WorkoutExerciseWithSets) {
    Alert.alert(
      'Remove exercise',
      `Remove ${exercise.exerciseName} from everyone’s workout? Their logged sets for it are removed too.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void removeExercise(exercise.exerciseId),
        },
      ],
    );
  }

  if (loading) return <LoadingState testID={`${testID}-loading`} />;
  if (members.length === 0) return null;

  // The signed-in person's own tab: the one their own records and settings apply to.
  const ownTab = selected?.userId === userId;

  // One muscle tab per primary muscle group the group's exercises train, in the order first
  // added; a tab whose last exercise is removed goes, and All shows again.
  const muscleTabs = workoutMuscleTabs(exercises);
  const activeMuscleTab: MuscleTab =
    muscleTab !== 'all' && muscleTabs.includes(muscleTab) ? muscleTab : 'all';
  const shownExercises = exercises.filter(
    (exercise) => activeMuscleTab === 'all' || exercise.muscleGroup === activeMuscleTab,
  );
  // The warm-up tip sits on the first exercise on show, as in Active Workout.
  const hintedExerciseId = shownExercises.find((shape) => rowFor(shape.exerciseId))?.exerciseId;

  const tabs = members.map((m) => ({
    key: m.userId,
    label: m.userId === userId ? 'You' : firstName(m.displayName),
    icon: 'user' as const,
  }));

  return (
    <View testID={testID} style={styles.root}>
      <RiseInStack>
        {members.length > 1 ? (
          <UnderlineTabs
            categories={tabs}
            active={selected?.userId ?? userId}
            onSelect={setSelectedId}
            accentColor={accentColor}
            testID={`${testID}-tabs`}
          />
        ) : null}

        <Card>
          <WorkoutStats
            testID={`${testID}-summary`}
            performedAt={startedAt}
            active
            totalSets={computeTotalSets(selectedDetail?.exercises ?? [])}
            totalExercises={selectedDetail?.exercises.length ?? 0}
          />
          {ownTab ? (
            <RepRangeRow
              testID={`${testID}-rep-range`}
              progression={progression}
              exercises={selectedDetail?.exercises ?? []}
              accentColor={accentColor}
            />
          ) : null}
        </Card>

        {error ? (
          <Text testID={`${testID}-error`} style={styles.error}>
            {error}
          </Text>
        ) : null}

        {exercises.length === 0 ? (
          <EmptyState testID={`${testID}-empty`} title="Add your first exercise to get started." />
        ) : null}

        {muscleTabs.length > 0 ? (
          <FilterChips<MuscleTab>
            testID={`${testID}-muscle-tabs`}
            options={[
              { value: 'all', label: 'All' },
              ...muscleTabs.map((muscle) => ({
                value: muscle,
                label: MUSCLE_GROUP_LABELS[muscle],
              })),
            ]}
            value={activeMuscleTab}
            onChange={setMuscleTab}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
        ) : null}

        {shownExercises.map((shape) => {
          const row = rowFor(shape.exerciseId);
          if (!row) return null;
          const prior = selected ? previous[`${selected.userId}:${row.exerciseId}`] : undefined;
          const type = measurementTypeOf(row);
          const previousSession: PreviousSessionDisplay | null = buildPreviousSessionDisplay(
            prior,
            weightUnit,
            type,
          );
          return (
            <ExerciseCard
              {...(ownTab ? progression.cardPropsFor(row, prior?.sets) : null)}
              key={row.exerciseId}
              exerciseId={row.exerciseId}
              testID={`${testID}-exercise-${row.exerciseId}`}
              exerciseName={row.exerciseName}
              muscleGroup={row.muscleGroup}
              movementType={row.movementType}
              measurementType={type}
              photoUrl={row.photoUrl}
              gym={row.gym}
              grip={row.grip}
              attachment={row.attachment}
              weightUnit={weightUnit}
              previousSession={previousSession}
              sets={
                row.movementType === 'unilateral' ? [] : computeCardSets(row.sets, setInputs, type)
              }
              unilateralSets={
                row.movementType === 'unilateral'
                  ? computeUnilateralSets(row.sets, setInputs, type)
                  : []
              }
              onChangeWeight={changeWeight}
              onChangeReps={changeReps}
              onChangeDuration={changeDuration}
              onAddSet={() => void addSet(row)}
              onAddDropSet={warmupsAndDrops ? () => void addDropSet(row.id) : undefined}
              onToggleWarmup={warmupsAndDrops ? toggleWarmup : undefined}
              warmupHint={
                warmupsAndDrops && showWarmupHint && row.exerciseId === hintedExerciseId
                  ? warmupHint
                  : null
              }
              onRemoveSet={removeSet}
              onRemoveExercise={() => confirmRemove(row)}
              accentColor={accentColor}
              onAccentColor={onAccentColor}
            />
          );
        })}

        <AddExerciseButton testID={`${testID}-add-exercise`} onPress={() => setPickerOpen(true)} />
        <CreateCustomExerciseButton
          testID={`${testID}-create-custom`}
          onPress={() => setCustomOpen(true)}
        />
      </RiseInStack>

      <LiveProgressionSheets
        progression={progression}
        accentColor={accentColor}
        onAccentColor={onAccentColor}
      />
      <ExercisePickerModal
        previous={
          previousExercises && {
            state: previousExercises,
            addedGroups: exercises.map((ex) => ex.muscleGroup),
            weightUnit,
          }
        }
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(exercise) => void addExercise(exercise)}
        userId={userId}
        alreadyAddedIds={exercises.map((ex) => ex.exerciseId)}
        onCreateCustom={() => {
          setPickerOpen(false);
          setCustomOpen(true);
        }}
        accentColor={accentColor}
        onAccentColor={onAccentColor}
      />
      <Modal visible={customOpen} animationType="slide" onRequestClose={() => setCustomOpen(false)}>
        {/* A native Modal opens its own window, outside AppBackgroundLayer, so it needs its
            own warm background fill -- same reason ExercisePickerModal's
            own root does this. Without it, Screen's deliberately transparent root (see that
            component's own comment) has nothing behind it and falls back to plain white. */}
        <View
          testID={`${testID}-create-custom-modal`}
          style={[styles.customExerciseModal, { backgroundColor: colors.background }]}
        >
          <ExerciseFormScreen
            mode="create"
            accentColor={accentColor}
            onAccentColor={onAccentColor}
            onDone={() => {
              setCustomOpen(false);
              setPickerOpen(true);
            }}
            onCancel={() => setCustomOpen(false)}
          />
        </View>
      </Modal>
    </View>
  );
}

function firstName(name: string | null): string {
  return name?.trim().split(/\s+/)[0] || 'Member';
}

const styles = StyleSheet.create({
  root: {
    gap: widgetGap,
  },
  error: {
    ...typeScale.secondary,
    color: colors.destructive,
  },
  customExerciseModal: {
    flex: 1,
  },
});
