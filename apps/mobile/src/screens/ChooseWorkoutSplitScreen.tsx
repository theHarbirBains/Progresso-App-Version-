import { useCallback, useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { SecondaryButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import type { RootStackScreenProps } from '../navigation/types';
import { useProfile } from '../profile/ProfileProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { fetchWorkoutSplits, materializeWorkoutSplitPreset } from '../workouts/workoutSplitQueries';
import { WORKOUT_SPLIT_PRESETS, type WorkoutSplitPreset } from '../workouts/workoutSplitPresets';
import { PRESET_DESCRIPTIONS } from '../workouts/workoutSplitPresetDisplay';
import { chooseWorkoutSplitStyles as styles } from './chooseWorkoutSplitStyles';

type Props = RootStackScreenProps<'ChooseWorkoutSplit'>;

// Reached either as the first-time "you need an active split before you can
// track a workout" gate (from NewWorkoutScreen) or, later, as a way to pick
// a different starting point for a brand-new split. Either way, selecting
// a preset here always both creates AND activates the resulting split --
// this screen exists specifically to answer "what should my active split
// be", unlike WorkoutSplitsScreen's own "Create Workout Split" button
// (adding an additional, inactive split to switch to later).
//
// Layout: the presets are plain rows (name, a one-line description, the day
// names) -- picking one is the primary action, so it needs no card, icon or
// badge of its own; "Create Custom Split" is the one secondary action below.
//
// This screen's list/create-own rendering is intentionally NOT the shared
// WorkoutSplitPresetPicker used by onboarding's split step: that component
// is also rendered inside OnboardingScreen, so restyling it would visually
// change onboarding as a side effect, which is out of scope for this
// screen-only migration. The underlying data/query functions are still
// shared -- only the presentation is local to this screen.
//
// Each preset's third line is its days' own `name`s (e.g. "Push · Pull ·
// Legs") -- a concise, already-existing summary -- rather than the day's
// full structured muscle-group list. The full list (e.g. Push -> Chest,
// Front Delts, Side Delts, Triceps) still exists in workoutSplitPresets.ts
// and is exactly what gets materialized into the user's real split; this
// screen simply chooses not to print it all out.
export function ChooseWorkoutSplitScreen({ navigation }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const { theme, activeWorkoutSplitId } = useProgressTheme();
  const { updateProfile } = useProfile();

  const [busyPresetId, setBusyPresetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Not a stored link back to a preset (materializing deep-copies a preset
  // into an independent split with no source-preset reference) -- this is a
  // best-effort name match against the user's current active split, purely
  // to decide which row (if any) shows as already-selected. A renamed or
  // fully custom active split simply matches nothing, which is a safe,
  // correct fallback (no row shows as selected).
  const [activeSplitName, setActiveSplitName] = useState<string | null>(null);

  const loadActiveSplitName = useCallback(async () => {
    if (!userId || !activeWorkoutSplitId) return;
    try {
      const splits = await fetchWorkoutSplits(userId);
      const active = splits.find((s) => s.id === activeWorkoutSplitId);
      setActiveSplitName(active?.name ?? null);
    } catch {
      // Selection highlighting is a nice-to-have -- a failed lookup just
      // means no row shows as selected, not a screen-level error.
    }
  }, [userId, activeWorkoutSplitId]);

  useEffect(() => {
    loadActiveSplitName();
  }, [loadActiveSplitName]);

  async function handleSelectPreset(preset: WorkoutSplitPreset) {
    if (!userId || !accessToken || busyPresetId) return;
    setError(null);
    setBusyPresetId(preset.id);
    try {
      const split = await materializeWorkoutSplitPreset(userId, preset);
      // Through the shared cache's own write path, not updateMyProfile
      // directly -- so every other screen reading activeWorkoutSplitId
      // (NewWorkoutScreen, WorkoutSplitsScreen, ...) sees the new active
      // split immediately, with no second fetch.
      await updateProfile({ activeWorkoutSplitId: split.id });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select workout split');
      setBusyPresetId(null);
    }
  }

  return (
    <Screen
      scrollTestID="choose-split-scroll"
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          title="Choose Your Split"
          subtitle="Pick a split that matches your goals and schedule."
          leftAction={{
            icon: 'arrow-left',
            onPress: () => navigation.goBack(),
            accessibilityLabel: 'Back',
            testID: 'choose-split-back',
          }}
          rightAction={{
            icon: 'settings',
            onPress: () => navigation.navigate('WorkoutSplits'),
            accessibilityLabel: 'Manage workout splits',
            testID: 'choose-split-settings',
          }}
        />
      }
    >
      {error ? (
        <Text testID="choose-split-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      <Section title="Presets">
        {WORKOUT_SPLIT_PRESETS.map((preset, index) => {
          const busy = busyPresetId === preset.id;
          const isActive = activeSplitName === preset.name;
          const selected = busy || isActive;
          const disabled = busyPresetId !== null && !busy;
          return (
            <ListRow
              key={preset.id}
              testID={`choose-split-preset-${preset.id}`}
              titleTestID={`choose-split-preset-${preset.id}-name`}
              divider={index > 0}
              title={preset.name}
              subtitle={PRESET_DESCRIPTIONS[preset.id]}
              detail={preset.days.map((day) => day.name).join(' · ')}
              onPress={() => handleSelectPreset(preset)}
              disabled={disabled}
              trailing={
                selected ? (
                  <Feather
                    testID={`choose-split-preset-${preset.id}-selected`}
                    name="check-circle"
                    size={20}
                    color={theme.accent}
                  />
                ) : undefined
              }
              accessibilityLabel={`${preset.name}. ${PRESET_DESCRIPTIONS[preset.id]}${
                selected ? '. Selected' : ''
              }`}
            />
          );
        })}
      </Section>

      <Section title="Build your own">
        <SecondaryButton
          testID="choose-split-create-own"
          label="Create Custom Split"
          onPress={() => navigation.navigate('WorkoutSplitForm', { activateOnCreate: true })}
        />
      </Section>
    </Screen>
  );
}
