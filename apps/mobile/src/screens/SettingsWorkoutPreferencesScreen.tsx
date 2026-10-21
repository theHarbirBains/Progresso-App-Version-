import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { StyleSheet, View } from 'react-native';
import { Text } from '../design/Text';
import { AppHeader } from '../design/AppHeader';
import { BottomSheet } from '../design/BottomSheet';
import { TextButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { Toggle } from '../design/Toggle';
import { colors, spacing, typeScale } from '../design/theme';
import type { TrainingComfort, UpdateProfileInput } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import {
  TRAINING_COMFORT_OPTIONS,
  WORKOUT_FREQUENCY_OPTIONS,
} from '../onboarding/onboardingOptions';
import { TrainingComfortSelector } from '../onboarding/TrainingComfortSelector';
import { useProfile } from '../profile/ProfileProvider';
import { RepRangeSheet } from '../settings/RepRangeSheet';
import { settingsStyles as styles } from '../settings/settingsStyles';
import {
  clearExerciseSetting,
  fetchExerciseSettings,
  type ExerciseProgressionSetting,
} from '../workouts/exerciseSettingsQueries';
import { formatRepRange, type RepRange } from '../workouts/progression';
import { formatWeightKg } from '../lib/units';

// Any range from 1 rep up to 50, as the database allows: the bottom never above the top. A
// range of one number (5-5) is a fixed target.

type Props = RootStackScreenProps<'SettingsWorkoutPreferences'>;

/**
 * Workout Preferences: the weekly workout goal collected at onboarding
 * (workoutFrequencyDays), and progression -- how comfortable you are planning
 * and progressing your training (onboarding's comfort question), the one rep
 * range every exercise is trained to, and whether the live workout suggests
 * when to go heavier or make an exercise harder (workouts/progression.ts).
 * Each saves through the same updateProfile call onboarding uses. Changing the
 * comfort answer doesn't change the range: onboarding only starts it from
 * there. Rest-timer, set-logging, and workout-completion preferences aren't
 * built into the app yet, so there's nothing real to add for them here.
 */
export function SettingsWorkoutPreferencesScreen({ navigation }: Props) {
  const { profile, loading, updateProfile } = useProfile();
  const { user } = useAuth();
  const userId = user?.id;
  // Exercises with their own range or weight step, set from the exercise in a workout. Listed
  // here so any can go back to the person's own range.
  const [exerciseSettings, setExerciseSettings] = useState<ExerciseProgressionSetting[]>([]);
  const [exerciseSheetOpen, setExerciseSheetOpen] = useState(false);
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchExerciseSettings(userId)
      .then((settings) => {
        if (!cancelled) {
          setExerciseSettings(
            [...settings.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName)),
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleResetExercise(exerciseId: string) {
    if (!userId) return;
    setExerciseError(null);
    try {
      await clearExerciseSetting(userId, exerciseId);
      setExerciseSettings((prev) => prev.filter((setting) => setting.exerciseId !== exerciseId));
    } catch (err) {
      setExerciseError(err instanceof Error ? err.message : 'Failed to reset the exercise');
    }
  }
  const [sheetOpen, setSheetOpen] = useState(false);
  const [comfortSheetOpen, setComfortSheetOpen] = useState(false);
  const [rangeDraft, setRangeDraft] = useState<RepRange | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selected = WORKOUT_FREQUENCY_OPTIONS.find(
    (option) => option.value === profile?.workoutFrequencyDays,
  );
  const comfort = TRAINING_COMFORT_OPTIONS.find(
    (option) => option.value === profile?.trainingComfort,
  );
  const range: RepRange = { min: profile?.repRangeMin ?? 8, max: profile?.repRangeMax ?? 12 };

  async function save(updates: UpdateProfileInput) {
    setSaveError(null);
    setSaving(true);
    try {
      await updateProfile(updates);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleSelect(value: number) {
    setSheetOpen(false);
    await save({ workoutFrequencyDays: value });
  }

  async function handleSelectComfort(value: TrainingComfort) {
    setComfortSheetOpen(false);
    await save({ trainingComfort: value });
  }

  async function handleSaveRange(next: RepRange) {
    setRangeDraft(null);
    await save({ repRangeMin: next.min, repRangeMax: next.max });
  }

  if (loading) {
    return <LoadingState testID="settings-workout-preferences-loading" />;
  }

  return (
    <Screen
      testID="settings-workout-preferences-screen"
      scrollTestID="settings-workout-preferences-scroll"
      contentContainerStyle={styles.categoryGap}
      header={
        <AppHeader
          testID="settings-workout-preferences-header"
          title="Workout Preferences"
          onBack={() => navigation.goBack()}
        />
      }
    >
      <Section title="Goal">
        <ListRow
          testID="open-weekly-workout-goal"
          icon="target"
          title="Weekly Workout Goal"
          value={selected ? selected.label : 'Not set'}
          onPress={() => setSheetOpen(true)}
          disabled={saving}
        />
      </Section>

      <Section title="Progression">
        <ListRow
          testID="open-training-comfort"
          icon="compass"
          title="Training Comfort"
          subtitle={comfort ? comfort.label : 'Not set'}
          onPress={() => setComfortSheetOpen(true)}
          disabled={saving}
        />
        <ListRow
          testID="open-rep-range"
          icon="repeat"
          title="Rep Range"
          subtitle="Unless an exercise has its own"
          value={formatRepRange(range)}
          onPress={() => setRangeDraft(range)}
          disabled={saving}
          divider
        />
        <ListRow
          testID="open-exercise-ranges"
          icon="sliders"
          title="Exercise Ranges"
          subtitle="Set from an exercise in your workout"
          value={String(exerciseSettings.length)}
          onPress={() => setExerciseSheetOpen(true)}
          divider
        />
        <ListRow
          testID="progression-tips-row"
          icon="trending-up"
          title="Progression Tips"
          subtitle="Say when to go heavier or make an exercise harder"
          divider
          trailing={
            <Toggle
              testID="progression-tips-toggle"
              value={profile?.progressionCuesEnabled ?? true}
              onValueChange={(value) => void save({ progressionCuesEnabled: value })}
              disabled={saving}
              accessibilityLabel="Progression Tips"
            />
          }
        />
      </Section>

      {saveError ? (
        <Text testID="settings-workout-preferences-error" style={styles.errorText}>
          {saveError}
        </Text>
      ) : null}

      <BottomSheet
        visible={exerciseSheetOpen}
        onClose={() => setExerciseSheetOpen(false)}
        testID="exercise-ranges-sheet"
      >
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Exercise Ranges</Text>
        <Text style={localStyles.sheetHelp}>
          An exercise with its own range is judged against it instead of yours. Change one from the
          exercise in a workout.
        </Text>
        {exerciseSettings.length === 0 ? (
          <Text testID="exercise-ranges-empty" style={localStyles.sheetHelp}>
            No exercise has its own range or weight step.
          </Text>
        ) : (
          exerciseSettings.map((setting, index) => (
            <ListRow
              key={setting.exerciseId}
              testID={`exercise-range-row-${setting.exerciseId}`}
              title={setting.exerciseName}
              subtitle={[
                setting.range ? `Range ${formatRepRange(setting.range)}` : null,
                setting.incrementKg !== null
                  ? `Step ${formatWeightKg(setting.incrementKg, profile?.weightUnit ?? 'lb')} ${profile?.weightUnit ?? 'lb'}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              divider={index > 0}
              trailing={
                <TextButton
                  testID={`exercise-range-reset-${setting.exerciseId}`}
                  label="Use Mine"
                  accessibilityLabel={`Use your own range for ${setting.exerciseName}`}
                  onPress={() => void handleResetExercise(setting.exerciseId)}
                />
              }
            />
          ))
        )}
        {exerciseError ? (
          <Text testID="exercise-ranges-error" style={styles.errorText}>
            {exerciseError}
          </Text>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        testID="weekly-workout-goal-sheet"
      >
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Weekly Workout Goal</Text>
        {WORKOUT_FREQUENCY_OPTIONS.map((option, index) => (
          <ListRow
            key={option.value}
            testID={`weekly-workout-goal-${option.value}`}
            title={option.label}
            chevron={false}
            divider={index > 0}
            trailing={
              option.value === profile?.workoutFrequencyDays ? (
                <Text style={{ color: colors.textSecondary }}>✓</Text>
              ) : undefined
            }
            onPress={() => void handleSelect(option.value)}
          />
        ))}
      </BottomSheet>

      <BottomSheet
        visible={comfortSheetOpen}
        onClose={() => setComfortSheetOpen(false)}
        testID="training-comfort-sheet"
      >
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
          How comfortable are you with planning and progressing your workouts?
        </Text>
        <View style={localStyles.comfortOptions}>
          <TrainingComfortSelector
            testID="training-comfort"
            value={profile?.trainingComfort ?? null}
            onChange={(value) => void handleSelectComfort(value)}
          />
        </View>
      </BottomSheet>

      <RepRangeSheet
        draft={rangeDraft}
        onChangeDraft={setRangeDraft}
        onClose={() => setRangeDraft(null)}
        onSave={(next) => void handleSaveRange(next)}
      />
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  sheetHelp: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  comfortOptions: {
    marginTop: spacing.md,
  },
});
