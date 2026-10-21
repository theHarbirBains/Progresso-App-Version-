import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { TextButton } from '../design/Button';
import { Text } from '../design/Text';
import { fetchAllExercises, type ExerciseRow } from '../exercises/exerciseQueries';
import { measurementTypeOf, type MeasurementType } from '../exercises/movementTypes';
import { useProfile } from '../profile/ProfileProvider';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';
import { RepRangeSheet } from '../settings/RepRangeSheet';
import {
  fetchExerciseSettings,
  saveExerciseSetting,
  type ExerciseProgressionSetting,
} from './exerciseSettingsQueries';
import { ExerciseProgressionSheet } from './ExerciseProgressionSheet';
import {
  effectiveRepRange,
  formatRepRange,
  progressionForExercise,
  type ProgressionSettings,
  type RepRange,
} from './progression';
import type { SetRecord, WorkoutExerciseWithSets } from './workoutQueries';

type EditingExercise = {
  exerciseId: string;
  exerciseName: string;
  measurementType: MeasurementType;
};

export interface LiveProgression {
  settings: ProgressionSettings;
  /** What an exercise's widget shows about progression, from the signed-in person's own records. */
  cardPropsFor: (
    exercise: WorkoutExerciseWithSets,
    lastSessionSets: SetRecord[] | undefined,
  ) => Pick<
    ReturnType<typeof progressionForExercise>,
    'allTimeBest' | 'lastTimeFlags' | 'sessionCue'
  > & { ownRangeText: string | null; onEditProgression?: () => void };
  /** How many of these exercises have a range of their own. */
  ownRangeCount: (exercises: WorkoutExerciseWithSets[]) => number;
  /** Opens the person's own rep range. */
  editRepRange: () => void;
  // The sheets' state, for LiveProgressionSheets.
  repRangeDraft: RepRange | null;
  setRepRangeDraft: (draft: RepRange | null) => void;
  saveRepRange: (range: RepRange) => Promise<void>;
  editingExercise: EditingExercise | null;
  closeExerciseRange: () => void;
  saveExerciseRange: (setting: {
    range: RepRange | null;
    incrementKg: number | null;
  }) => Promise<void>;
  exerciseSettings: Map<string, ExerciseProgressionSetting>;
  rangeSaving: boolean;
  rangeError: string | null;
  weightUnit: 'kg' | 'lb';
}

/**
 * Progressive overload in a live workout (workouts/progression.ts), for the signed-in person:
 * their one rep range and whether to suggest anything (read off the shared profile, so a change
 * in Settings shows straight away), each exercise's own range and weight step
 * (exerciseSettingsQueries.ts, an exercise's own range winning over theirs), their records (the
 * shared all-time stats) and their exercise library (to suggest the weighted version of a
 * bodyweight or timed exercise). Active Workout and a group session's own tab both use it.
 * Nothing breaks without any of it.
 */
export function useLiveProgression({
  userId,
  weightUnit,
  onError,
}: {
  userId: string;
  weightUnit: 'kg' | 'lb';
  /** Says what went wrong saving the person's own range. */
  onError: (message: string) => void;
}): LiveProgression {
  const { repPRs, exerciseRecords } = useAllTimeStats();
  const { profile, updateProfile } = useProfile();
  const settings: ProgressionSettings = {
    range: { min: profile?.repRangeMin ?? 8, max: profile?.repRangeMax ?? 12 },
    enabled: profile?.progressionCuesEnabled ?? true,
    unit: weightUnit,
  };

  // The person's exercise library (already cached for the picker).
  const [library, setLibrary] = useState<ExerciseRow[]>([]);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchAllExercises({ userId, search: '', muscleGroup: null, source: 'all' })
      .then((rows) => {
        if (!cancelled) setLibrary(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const [exerciseSettings, setExerciseSettings] = useState<Map<string, ExerciseProgressionSetting>>(
    new Map(),
  );
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchExerciseSettings(userId)
      .then((loaded) => {
        if (!cancelled) setExerciseSettings(loaded);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const [editingExercise, setEditingExercise] = useState<EditingExercise | null>(null);
  const [rangeSaving, setRangeSaving] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [repRangeDraft, setRepRangeDraft] = useState<RepRange | null>(null);

  async function saveExerciseRange(setting: {
    range: RepRange | null;
    incrementKg: number | null;
  }) {
    if (!userId || !editingExercise) return;
    setRangeError(null);
    setRangeSaving(true);
    try {
      const saved = await saveExerciseSetting(userId, editingExercise.exerciseId, setting);
      setExerciseSettings((prev) => {
        const next = new Map(prev);
        if (saved) next.set(editingExercise.exerciseId, saved);
        else next.delete(editingExercise.exerciseId);
        return next;
      });
      setEditingExercise(null);
    } catch (err) {
      setRangeError(err instanceof Error ? err.message : 'Failed to save the range');
    } finally {
      setRangeSaving(false);
    }
  }

  async function saveRepRange(range: RepRange) {
    setRepRangeDraft(null);
    try {
      await updateProfile({ repRangeMin: range.min, repRangeMax: range.max });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save your rep range');
    }
  }

  // One stable handler per exercise, so opening the range sheet never re-renders every widget.
  const rangeHandlersRef = useRef(new Map<string, () => void>());
  function rangeHandler(exercise: EditingExercise): () => void {
    const cached = rangeHandlersRef.current.get(exercise.exerciseId);
    if (cached) return cached;
    const handler = () => {
      setRangeError(null);
      setEditingExercise(exercise);
    };
    rangeHandlersRef.current.set(exercise.exerciseId, handler);
    return handler;
  }

  function ownRange(exercise: WorkoutExerciseWithSets): RepRange | null {
    if (measurementTypeOf(exercise) === 'timed') return null;
    return exerciseSettings.get(exercise.exerciseId)?.range ?? null;
  }

  return {
    settings,
    cardPropsFor(exercise, lastSessionSets) {
      const type = measurementTypeOf(exercise);
      const own = ownRange(exercise);
      const { allTimeBest, lastTimeFlags, sessionCue } = progressionForExercise({
        exercise,
        lastSessionSets,
        settings,
        repPRs,
        records: exerciseRecords,
        library,
        override: exerciseSettings.get(exercise.exerciseId) ?? null,
      });
      return {
        allTimeBest,
        lastTimeFlags,
        sessionCue,
        ownRangeText: own
          ? `Own range ${formatRepRange(effectiveRepRange(settings.range, own))}`
          : null,
        // A timed exercise has no range.
        onEditProgression:
          type === 'timed'
            ? undefined
            : rangeHandler({
                exerciseId: exercise.exerciseId,
                exerciseName: exercise.exerciseName,
                measurementType: type,
              }),
      };
    },
    ownRangeCount: (exercises) => exercises.filter((exercise) => ownRange(exercise)).length,
    editRepRange: () => setRepRangeDraft(settings.range),
    repRangeDraft,
    setRepRangeDraft,
    saveRepRange,
    editingExercise,
    closeExerciseRange: () => setEditingExercise(null),
    saveExerciseRange,
    exerciseSettings,
    rangeSaving,
    rangeError,
    weightUnit,
  };
}

/**
 * The person's one rep range, for every exercise without its own: an accent `repeat` glyph,
 * "Your rep range" with the range as a mono readout, how many exercises here have their own,
 * and Edit. Sits in the workout's own widget, under its stats.
 */
export function RepRangeRow({
  progression,
  exercises,
  accentColor,
  testID,
}: {
  progression: LiveProgression;
  exercises: WorkoutExerciseWithSets[];
  accentColor: string;
  testID: string;
}) {
  const ownCount = progression.ownRangeCount(exercises);
  return (
    <View testID={testID} style={styles.rangeRow}>
      <Feather name="repeat" size={16} color={accentColor} />
      <View style={styles.rangeBody}>
        <Text style={styles.rangeText}>
          Your rep range{' '}
          <Text testID={`${testID}-value`} style={styles.rangeValue}>
            {formatRepRange(progression.settings.range)}
          </Text>
        </Text>
        {ownCount > 0 ? (
          <Text testID={`${testID}-own`} style={styles.rangeNote}>
            {ownCount === 1
              ? '1 exercise here has its own'
              : `${ownCount} exercises here have their own`}
          </Text>
        ) : null}
      </View>
      <TextButton
        testID={`${testID}-edit`}
        label="Edit"
        accessibilityLabel="Change your rep range"
        onPress={progression.editRepRange}
      />
    </View>
  );
}

/** The two range sheets: the person's own range, and one exercise's own range and step. */
export function LiveProgressionSheets({
  progression,
  accentColor,
  onAccentColor,
}: {
  progression: LiveProgression;
  accentColor: string;
  onAccentColor: string;
}) {
  const { editingExercise } = progression;
  return (
    <>
      <RepRangeSheet
        draft={progression.repRangeDraft}
        onChangeDraft={progression.setRepRangeDraft}
        onClose={() => progression.setRepRangeDraft(null)}
        onSave={(range) => void progression.saveRepRange(range)}
        accentColor={accentColor}
        onAccentColor={onAccentColor}
      />
      <ExerciseProgressionSheet
        visible={editingExercise !== null}
        exerciseName={editingExercise?.exerciseName ?? ''}
        measurementType={editingExercise?.measurementType ?? 'weight_reps'}
        personalRange={progression.settings.range}
        current={
          editingExercise
            ? (progression.exerciseSettings.get(editingExercise.exerciseId) ?? null)
            : null
        }
        unit={progression.weightUnit}
        saving={progression.rangeSaving}
        error={progression.rangeError}
        onSave={(setting) => void progression.saveExerciseRange(setting)}
        onClose={progression.closeExerciseRange}
        accentColor={accentColor}
        onAccentColor={onAccentColor}
      />
    </>
  );
}
