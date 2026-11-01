import { useContext, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { Card } from '../design/Card';
import { PrimaryButton } from '../design/Button';
import { toLocalDateKey } from '../design/calendarGrid';
import { RiseInStack } from '../design/RiseIn';
import { Screen } from '../design/Screen';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import { logWorkoutForClient } from '../lib/api';
import { draftValues } from '../workouts/setInputDrafts';
import { AppMenuContext } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { AddExerciseButton } from '../workouts/AddExerciseButton';
import { CreateCustomExerciseButton } from '../workouts/CreateCustomExerciseButton';
import { ExercisePickerModal } from '../workouts/ExercisePickerModal';
import {
  PastExerciseCard,
  PastWorkoutDateSheet,
  PastWorkoutDetailsCard,
} from '../workouts/PastWorkoutForm';
import { setsToSave, usePastWorkoutDate, usePastWorkoutDraft } from '../workouts/pastWorkoutDraft';
import {
  addExerciseToWorkout,
  createLoggedWorkout,
  createSet,
  updateSet,
} from '../workouts/workoutQueries';
import { ExerciseFormScreen } from './ExerciseFormScreen';
import { liveWorkoutStyles } from './liveWorkoutStyles';
import { logPastWorkoutStyles as styles } from './logPastWorkoutStyles';

type Props = RootStackScreenProps<'LogPastWorkout' | 'TrainerLogWorkout'>;

/**
 * A workout that already happened, logged after the fact: pick a date, name
 * it, add exercises and their sets directly -- no live timer, no in-progress
 * state, nothing persisted until "Save Workout". This is deliberately a
 * different data model from ActiveWorkoutScreen's live tracking (which
 * persists every add/complete immediately against a real in-progress
 * workout row): here nothing touches the database until the very end, so
 * backing out of this screen at any point leaves no trace. Reuses
 * ExercisePickerModal/ExerciseFormScreen for exercise selection (identical
 * to the live flow) but not ExerciseCard/SetRow -- those are built around a
 * completed/incomplete distinction that doesn't apply when every row typed
 * in already represents something done; see PastSetRow's own comment.
 */
export function LogPastWorkoutScreen({ navigation, route }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  // Set when a trainer logs the workout for a client (see TrainerClientDetail).
  // The save then goes through the trainer API, never the trainer's own data.
  // Only TrainerLogWorkout carries these; the route type is shared with the plain
  // LogPastWorkout entry, which has no params, so they are read through a cast.
  // The side menu, for the menu button (absent outside the app shell, e.g. in a test).
  const menu = useContext(AppMenuContext);
  const trainerParams = route?.params as { clientId: string; clientName?: string } | undefined;
  const clientId = trainerParams?.clientId;
  const clientName = trainerParams?.clientName;
  const { theme, weightUnit } = useProgressTheme();
  const { refetch: refetchAllTimeStats } = useAllTimeStats();

  const when = usePastWorkoutDate();
  const { date } = when;
  const [name, setName] = useState('');
  const [durationHours, setDurationHours] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const draft = usePastWorkoutDraft();
  const { exercises } = draft;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customExerciseOpen, setCustomExerciseOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSelectExercise(exercise: ExerciseRow) {
    setPickerOpen(false);
    setError(null);
    draft.addExercise(exercise);
  }

  async function handleSave() {
    if (!userId || saving) return;
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Enter a name for this workout');
      return;
    }
    if (toLocalDateKey(date) > toLocalDateKey(new Date())) {
      setError("Pick a date that's already happened");
      return;
    }
    // Only the sets filled in, and only the exercises left with any.
    const toSave = exercises
      .map((ex) => ({ ...ex, sets: setsToSave(ex) }))
      .filter((ex) => ex.sets.length > 0);
    if (toSave.length === 0) {
      setError('Add at least one exercise with a weight and rep count');
      return;
    }

    setSaving(true);
    try {
      const performedAtIso = date.toISOString();
      const totalDurationMinutes =
        (Number(durationHours) || 0) * 60 + (Number(durationMinutes) || 0);
      // Omit entirely (rather than pass 0) when no duration was entered --
      // createLoggedWorkout's own default (completedAt = performedAt) is
      // what makes every existing duration readout show "--" instead of a
      // fabricated "0 min".
      const completedAtIso =
        totalDurationMinutes > 0
          ? new Date(date.getTime() + totalDurationMinutes * 60000).toISOString()
          : undefined;
      if (clientId) {
        if (!session?.access_token) throw new Error('You are signed out');
        await logWorkoutForClient(session.access_token, clientId, {
          name: trimmedName,
          performedAt: performedAtIso,
          completedAt: completedAtIso,
          exercises: toSave.map((ex) => ({
            exerciseId: ex.exerciseId,
            sets: ex.sets.map((set) => ({
              setIndex: set.setIndex,
              side: set.side ?? 'none',
              ...draftValues(set, ex.measurementType, weightUnit),
            })),
          })),
        });
        navigation.replace('TrainerClientDetail', { clientId, clientName });
        return;
      }

      const workout = await createLoggedWorkout(
        userId,
        trimmedName,
        performedAtIso,
        completedAtIso,
      );

      let orderIndex = 1;
      for (const ex of toSave) {
        const workoutExerciseId = await addExerciseToWorkout(workout.id, ex.exerciseId, orderIndex);
        orderIndex += 1;
        for (const set of ex.sets) {
          const created = await createSet(workoutExerciseId, set.setIndex, set.side ?? undefined);
          await updateSet(created.id, {
            ...draftValues(set, ex.measurementType, weightUnit),
            completedAt: performedAtIso,
          });
        }
      }

      void refetchAllTimeStats();
      navigation.replace('WorkoutDetail', { workoutId: workout.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workout');
      setSaving(false);
    }
  }

  if (customExerciseOpen) {
    return (
      <ExerciseFormScreen
        mode="create"
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        onDone={() => {
          setCustomExerciseOpen(false);
          setPickerOpen(true);
        }}
        onCancel={() => setCustomExerciseOpen(false)}
      />
    );
  }

  return (
    <>
      <Screen
        scroll={false}
        padded={false}
        keyboardAvoiding
        // Its widgets roll out from inside the list (RiseInStack), so the list doesn't also rise.
        rollout={false}
        header={
          <AppHeader
            testID="log-past-workout-header"
            title={clientName ? `Log for ${clientName}` : 'Log a Past Workout'}
            {...(menu && !clientId
              ? {
                  leftAction: {
                    icon: 'menu' as const,
                    onPress: () => menu.openMenu(),
                    accessibilityLabel: 'Open menu',
                    testID: 'log-past-workout-open-menu',
                  },
                }
              : { onBack: () => navigation.goBack() })}
          />
        }
      >
        <ScrollView
          style={liveWorkoutStyles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <RiseInStack>
            {error ? (
              <Text testID="log-past-workout-error" style={liveWorkoutStyles.errorText}>
                {error}
              </Text>
            ) : null}

            <PastWorkoutDetailsCard
              testID="log-past-workout"
              when={when}
              name={name}
              onChangeName={setName}
              duration={{
                hours: durationHours,
                minutes: durationMinutes,
                onChangeHours: setDurationHours,
                onChangeMinutes: setDurationMinutes,
              }}
            />

            {exercises.map((exercise) => (
              <PastExerciseCard
                key={exercise.localId}
                testID="log-past-workout"
                exercise={exercise}
                draft={draft}
              />
            ))}

            <Card testID="log-past-workout-add-card" style={styles.cardBody}>
              {exercises.length === 0 ? (
                <Text testID="log-past-workout-empty" style={styles.hint}>
                  Add the exercises you did, then fill in their sets.
                </Text>
              ) : null}
              <AddExerciseButton
                testID="log-past-workout-add-exercise"
                onPress={() => setPickerOpen(true)}
              />
              <CreateCustomExerciseButton
                testID="log-past-workout-create-custom"
                onPress={() => setCustomExerciseOpen(true)}
              />
            </Card>
          </RiseInStack>
        </ScrollView>

        <View style={liveWorkoutStyles.footer}>
          <PrimaryButton
            testID="log-past-workout-save"
            label={saving ? 'Saving…' : 'Save Workout'}
            onPress={handleSave}
            disabled={saving}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        </View>
      </Screen>

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelectExercise}
        userId={userId}
        alreadyAddedIds={exercises.map((ex) => ex.exerciseId)}
        onCreateCustom={() => {
          setPickerOpen(false);
          setCustomExerciseOpen(true);
        }}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
      />

      <PastWorkoutDateSheet
        testID="log-past-workout"
        when={when}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
      />
    </>
  );
}
