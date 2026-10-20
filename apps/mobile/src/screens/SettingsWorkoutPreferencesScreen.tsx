import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../design/Text';
import { AppHeader } from '../design/AppHeader';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { Toggle } from '../design/Toggle';
import { WheelPicker } from '../design/WheelPicker';
import { colors, spacing, typeScale } from '../design/theme';
import type { TrainingComfort, UpdateProfileInput } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import {
  TRAINING_COMFORT_OPTIONS,
  WORKOUT_FREQUENCY_OPTIONS,
} from '../onboarding/onboardingOptions';
import { TrainingComfortSelector } from '../onboarding/TrainingComfortSelector';
import { useProfile } from '../profile/ProfileProvider';
import { settingsStyles as styles } from '../settings/settingsStyles';
import { formatRepRange, type RepRange } from '../workouts/progression';

// Any range from 1 rep up to 50, as the database allows: the bottom always below the top.
const RANGE_BOTTOMS = Array.from({ length: 49 }, (_, i) => String(i + 1));
const RANGE_TOPS = Array.from({ length: 49 }, (_, i) => String(i + 2));

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
  const rangeDraftValid = rangeDraft !== null && rangeDraft.min < rangeDraft.max;

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

  async function handleSaveRange() {
    if (!rangeDraft || !rangeDraftValid) return;
    const next = rangeDraft;
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
          subtitle="For every exercise"
          value={formatRepRange(range)}
          onPress={() => setRangeDraft(range)}
          disabled={saving}
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

      <BottomSheet
        visible={rangeDraft !== null}
        onClose={() => setRangeDraft(null)}
        testID="rep-range-sheet"
      >
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Rep Range</Text>
        <Text style={localStyles.sheetHelp}>
          When an exercise&apos;s top set reaches the top of your range, it&apos;s time to go
          heavier.
        </Text>
        {rangeDraft ? (
          <View style={localStyles.wheels}>
            <View style={localStyles.wheel}>
              <Text style={localStyles.wheelLabel}>From</Text>
              <WheelPicker
                testID="rep-range-min"
                values={RANGE_BOTTOMS}
                selectedValue={String(rangeDraft.min)}
                onChange={(value) =>
                  setRangeDraft((prev) => prev && { ...prev, min: Number(value) })
                }
              />
            </View>
            <View style={localStyles.wheel}>
              <Text style={localStyles.wheelLabel}>To</Text>
              <WheelPicker
                testID="rep-range-max"
                values={RANGE_TOPS}
                selectedValue={String(rangeDraft.max)}
                onChange={(value) =>
                  setRangeDraft((prev) => prev && { ...prev, max: Number(value) })
                }
              />
            </View>
          </View>
        ) : null}
        {rangeDraft && !rangeDraftValid ? (
          <Text testID="rep-range-error" style={styles.errorText}>
            The bottom of the range has to be below the top.
          </Text>
        ) : null}
        <PrimaryButton
          testID="rep-range-save"
          label={rangeDraftValid ? `Save ${formatRepRange(rangeDraft)}` : 'Save'}
          onPress={() => void handleSaveRange()}
          disabled={!rangeDraftValid}
        />
      </BottomSheet>
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
  wheels: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginVertical: spacing.lg,
  },
  wheel: {
    flex: 1,
    gap: spacing.xs,
  },
  wheelLabel: {
    ...typeScale.label,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
