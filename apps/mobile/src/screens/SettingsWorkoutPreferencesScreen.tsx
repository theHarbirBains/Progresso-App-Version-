import { useState } from 'react';
import { Text } from '../design/Text';
import { AppHeader } from '../design/AppHeader';
import { BottomSheet } from '../design/BottomSheet';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { colors } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { WORKOUT_FREQUENCY_OPTIONS } from '../onboarding/onboardingOptions';
import { useProfile } from '../profile/ProfileProvider';
import { settingsStyles as styles } from '../settings/settingsStyles';

type Props = RootStackScreenProps<'SettingsWorkoutPreferences'>;

/**
 * Workout Preferences. Today this is exactly one real setting: the weekly
 * workout goal collected at onboarding (workoutFrequencyDays), which had no
 * way to change it afterward anywhere in the app until now -- same field,
 * same WORKOUT_FREQUENCY_OPTIONS catalog, same updateProfile call
 * onboarding's own step already uses. Rest-timer, set-logging, and
 * workout-completion preferences aren't built into the app yet, so there's
 * nothing real to add for them here -- see the Settings reorganization's
 * own audit notes.
 */
export function SettingsWorkoutPreferencesScreen({ navigation }: Props) {
  const { profile, loading, updateProfile } = useProfile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selected = WORKOUT_FREQUENCY_OPTIONS.find(
    (option) => option.value === profile?.workoutFrequencyDays,
  );

  async function handleSelect(value: number) {
    setSheetOpen(false);
    setSaveError(null);
    setSaving(true);
    try {
      await updateProfile({ workoutFrequencyDays: value });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
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
    </Screen>
  );
}
