import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { Badge } from '../design/Badge';
import { SectionHeader } from '../design/SectionHeader';
import { colors } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { getMyProfile, updateMyProfile } from '../lib/api';
import { useProgressTheme } from '../progress/useProgressTheme';
import { fetchWorkoutSplits, materializeWorkoutSplitPreset } from '../workouts/workoutSplitQueries';
import { WORKOUT_SPLIT_PRESETS, type WorkoutSplitPreset } from '../workouts/workoutSplitPresets';
import { PRESET_DESCRIPTIONS, PRESET_ICONS } from '../workouts/workoutSplitPresetDisplay';
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
// This screen's list/create-own rendering is intentionally NOT the shared
// WorkoutSplitPresetPicker used by onboarding's split step: that component
// is also rendered inside OnboardingScreen, so restyling it would visually
// change onboarding as a side effect, which is out of scope for this
// screen-only migration. The underlying data/query functions are still
// shared -- only the presentation is local to this screen.
//
// Card chip labels are each preset day's own `name` (e.g. "Push"/"Pull"/
// "Legs") -- a concise, already-existing summary -- rather than the day's
// full structured muscle-group list. The full list (e.g. Push -> Chest,
// Front Delts, Side Delts, Triceps) still exists in workoutSplitPresets.ts
// and is exactly what gets materialized into the user's real split; this
// screen simply chooses not to print it all out.
export function ChooseWorkoutSplitScreen({ navigation }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const { theme } = useProgressTheme();
  const insets = useSafeAreaInsets();

  const [busyPresetId, setBusyPresetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Not a stored link back to a preset (materializing deep-copies a preset
  // into an independent split with no source-preset reference) -- this is a
  // best-effort name match against the user's current active split, purely
  // to decide which card (if any) shows as already-selected. A renamed or
  // fully custom active split simply matches nothing, which is a safe,
  // correct fallback (no card shows as selected).
  const [activeSplitName, setActiveSplitName] = useState<string | null>(null);

  const loadActiveSplitName = useCallback(async () => {
    if (!userId || !accessToken) return;
    try {
      const profile = await getMyProfile(accessToken);
      if (!profile.activeWorkoutSplitId) return;
      const splits = await fetchWorkoutSplits(userId);
      const active = splits.find((s) => s.id === profile.activeWorkoutSplitId);
      setActiveSplitName(active?.name ?? null);
    } catch {
      // Selection highlighting is a nice-to-have -- a failed lookup just
      // means no card shows as selected, not a screen-level error.
    }
  }, [userId, accessToken]);

  useEffect(() => {
    loadActiveSplitName();
  }, [loadActiveSplitName]);

  async function handleSelectPreset(preset: WorkoutSplitPreset) {
    if (!userId || !accessToken || busyPresetId) return;
    setError(null);
    setBusyPresetId(preset.id);
    try {
      const split = await materializeWorkoutSplitPreset(userId, preset);
      await updateMyProfile(accessToken, { activeWorkoutSplitId: split.id });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select workout split');
      setBusyPresetId(null);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="choose-split-scroll"
      >
        <View style={styles.topRow}>
          <TouchableOpacity
            testID="choose-split-back"
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back"
            accessibilityRole="button"
          >
            <Feather name="chevron-left" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="choose-split-settings"
            style={[styles.settingsButton, { backgroundColor: theme.accent }]}
            onPress={() => navigation.navigate('WorkoutSplits')}
            accessibilityLabel="Manage workout splits"
            accessibilityRole="button"
          >
            <Feather name="settings" size={18} color={theme.onAccent} />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Choose your workout split</Text>
        <Text style={styles.subtitle}>Pick a split that matches your goals and schedule.</Text>

        {error ? (
          <Text testID="choose-split-error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        <View style={styles.presetList}>
          {WORKOUT_SPLIT_PRESETS.map((preset) => {
            const busy = busyPresetId === preset.id;
            const isActive = activeSplitName === preset.name;
            const selected = busy || isActive;
            const disabled = busyPresetId !== null && !busy;
            return (
              <AppCard
                key={preset.id}
                testID={`choose-split-preset-${preset.id}`}
                onPress={() => handleSelectPreset(preset)}
                style={[
                  styles.presetCard,
                  selected && { borderColor: theme.accent, borderWidth: 1.5 },
                  disabled && { opacity: 0.4 },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View
                    style={[styles.iconCircle, selected && { backgroundColor: theme.accentBg }]}
                  >
                    <Feather
                      name={PRESET_ICONS[preset.id] ?? 'layers'}
                      size={18}
                      color={colors.textPrimary}
                    />
                  </View>
                  <Text
                    testID={`choose-split-preset-${preset.id}-name`}
                    style={styles.presetName}
                    numberOfLines={1}
                  >
                    {preset.name}
                  </Text>
                  {selected ? (
                    <Feather
                      testID={`choose-split-preset-${preset.id}-selected`}
                      name="check-circle"
                      size={20}
                      color={theme.accent}
                    />
                  ) : (
                    <Feather name="chevron-right" size={20} color={colors.textMuted} />
                  )}
                </View>

                <Text style={styles.presetDescription}>{PRESET_DESCRIPTIONS[preset.id]}</Text>

                <View style={styles.chipRow}>
                  {preset.days.map((day) => (
                    <Badge
                      key={day.name}
                      label={day.name}
                      color={colors.textSecondary}
                      backgroundColor={colors.surfaceRaised}
                    />
                  ))}
                </View>
              </AppCard>
            );
          })}
        </View>

        <SectionHeader label="Build your own" />
        <TouchableOpacity
          testID="choose-split-create-own"
          style={[styles.createSplitButton, { backgroundColor: theme.accent }]}
          onPress={() => navigation.navigate('WorkoutSplitForm', { activateOnCreate: true })}
          accessibilityRole="button"
          accessibilityLabel="Create Custom Split"
        >
          <Feather name="edit-2" size={18} color={theme.onAccent} />
          <Text style={[styles.createSplitButtonText, { color: theme.onAccent }]}>
            Create Custom Split
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
