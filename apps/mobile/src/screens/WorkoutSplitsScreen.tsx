import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { useProfile } from '../profile/ProfileProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { SegmentedControl } from '../design/SegmentedControl';
import { ProgramBrowser } from '../programs/ProgramBrowser';
import { PROGRAMS_OPEN } from '../programs/programsAvailability';
import { preferencesFromProfile } from '../programs/programPreferences';
import {
  deleteWorkoutSplit,
  duplicateWorkoutSplit,
  fetchWorkoutSplits,
  materializeWorkoutSplitPreset,
  type WorkoutSplitSummary,
} from '../workouts/workoutSplitQueries';
import { PresetCard, SplitCard, SplitsHeading, WorkoutProgramsCard } from '../workouts/SplitCards';
import { WORKOUT_SPLIT_PRESETS, type WorkoutSplitPreset } from '../workouts/workoutSplitPresets';
import { workoutSplitStyles as styles } from './workoutSplitStyles';

type Props = RootStackScreenProps<'WorkoutSplits'>;

type Tab = 'splits' | 'programs';

/** How many ready-made splits My Splits shows under Browse Splits; View All has every one. */
const MY_SPLITS_PRESETS = 3;

// Laid out after Harbir's reference (November 2026): the title with a line under it, then two tabs,
// My Splits (with how many) and Browse Splits, each with its glyph. My Splits: My Workout Splits --
// the active split first, outlined in the accent, then the rest, each a card (workouts/
// SplitCards.tsx) with its name, its days, Active and its switch, and Edit / Duplicate / Delete
// along its foot, a tap on its name opening it -- then Create Workout Split, the one filled
// button; Workout Programs (Coming Soon while PROGRAMS_OPEN is false); and Browse Splits, the
// first few ready-made splits with View All. Browse Splits: Workout Programs (and, once open,
// Harbir's library, programs/ProgramBrowser.tsx, with a way to tell us what to recommend from) and
// every ready-made split. A ready-made split tapped becomes one of their own, and the active one.
export function WorkoutSplitsScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { theme, activeWorkoutSplitId, themeLoading } = useProgressTheme();
  const { profile, updateProfile } = useProfile();
  const { openMenu } = useAppMenu();
  const preferences = useMemo(() => preferencesFromProfile(profile), [profile]);
  const [tab, setTab] = useState<Tab>(route.params?.tab ?? 'splits');
  // Explore More Programs comes back here on Programs.
  const requestedTab = route.params?.tab;
  useEffect(() => {
    if (requestedTab) setTab(requestedTab);
  }, [requestedTab]);
  // A profile handed back by an API from before these were asked has none of them.
  const noPreferences =
    (profile?.trainingPriorities ?? []).length === 0 && (profile?.equipmentAccess ?? null) === null;

  const [splits, setSplits] = useState<WorkoutSplitSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busySplitId, setBusySplitId] = useState<string | null>(null);
  // Only the very first load should replace the whole screen with a
  // spinner -- every later call (the focus listener, or refreshing the
  // list after a duplicate/delete, which already has its own per-row
  // busySplitId feedback) is a background refresh, same pattern as
  // DashboardScreen/ProfileScreen.
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!userId) return;
    if (!hasLoadedOnce.current) setLoading(true);
    setError(null);
    try {
      setSplits(await fetchWorkoutSplits(userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workout splits');
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  }, [userId]);

  // Loads each time the page comes into view -- including the first, so no separate mount load.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  useEffect(() => {
    setActiveId(activeWorkoutSplitId);
  }, [activeWorkoutSplitId]);

  async function makeActive(split: WorkoutSplitSummary) {
    setBusySplitId(split.id);
    try {
      await updateProfile({ activeWorkoutSplitId: split.id });
      setActiveId(split.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set active split');
    } finally {
      setBusySplitId(null);
    }
  }

  function confirmSelectActive(split: WorkoutSplitSummary) {
    if (split.id === activeId) return;
    Alert.alert('Make this your active workout split?', split.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Make Active', onPress: () => makeActive(split) },
    ]);
  }

  async function handleDuplicate(split: WorkoutSplitSummary) {
    if (!userId) return;
    setBusySplitId(split.id);
    try {
      await duplicateWorkoutSplit(userId, split.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate split');
    } finally {
      setBusySplitId(null);
    }
  }

  async function performDelete(split: WorkoutSplitSummary) {
    setBusySplitId(split.id);
    try {
      await deleteWorkoutSplit(split.id);
      if (split.id === activeId) setActiveId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete split');
    } finally {
      setBusySplitId(null);
    }
  }

  function confirmDelete(split: WorkoutSplitSummary) {
    Alert.alert('Delete Workout Split', `Delete "${split.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => performDelete(split) },
    ]);
  }

  // WorkoutSplitPresetPicker (materializeImmediately) only creates the new
  // split and hands back its id -- actually making it the active one, same
  // as picking a preset from Choose Workout Split, is this screen's own job.
  async function handlePresetActivated(newSplitId: string) {
    setError(null);
    try {
      await updateProfile({ activeWorkoutSplitId: newSplitId });
      setActiveId(newSplitId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select workout split');
    }
  }

  // A ready-made split chosen: made a split of their own and the active one, as Choose Workout
  // Split does it (one at a time; the others wait).
  const [busyPresetId, setBusyPresetId] = useState<string | null>(null);
  async function choosePreset(preset: WorkoutSplitPreset) {
    if (!userId || busyPresetId) return;
    setError(null);
    setBusyPresetId(preset.id);
    try {
      const made = await materializeWorkoutSplitPreset(userId, preset);
      await handlePresetActivated(made.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select workout split');
    } finally {
      setBusyPresetId(null);
    }
  }

  // The active split first, the rest in the order they came.
  const activeSplit = splits.find((split) => split.id === activeId) ?? null;
  const ordered = activeSplit
    ? [activeSplit, ...splits.filter((split) => split.id !== activeId)]
    : splits;

  if (loading || themeLoading) {
    return <LoadingState testID="workout-splits-loading" />;
  }

  const presetCards = (presets: readonly WorkoutSplitPreset[]) =>
    presets.map((preset) => (
      <PresetCard
        key={preset.id}
        testID={`workout-splits-presets-preset-${preset.id}`}
        preset={preset}
        busy={busyPresetId === preset.id}
        disabled={busyPresetId !== null && busyPresetId !== preset.id}
        accentColor={theme.accent}
        onPress={() => void choosePreset(preset)}
      />
    ));
  const programsCard = (
    <WorkoutProgramsCard
      testID="workout-splits-library"
      open={PROGRAMS_OPEN}
      accentColor={theme.accent}
      onPress={() => setTab('programs')}
    />
  );

  return (
    <Screen
      scrollTestID="workout-splits-scroll"
      contentContainerStyle={styles.listContent}
      header={
        <AppHeader
          testID="workout-splits-header"
          title="Workout Splits"
          subtitle="Manage your workout plans or discover new splits."
          leftAction={{
            icon: 'menu',
            onPress: () => openMenu(),
            accessibilityLabel: 'Open menu',
            testID: 'workout-splits-open-menu',
          }}
        />
      }
    >
      <SegmentedControl<Tab>
        testID="workout-splits-tabs"
        stretch
        options={[
          {
            value: 'splits',
            label: `My Splits (${splits.length})`,
            accessibilityLabel: `My Splits, ${splits.length}`,
            icon: (color) => <MaterialCommunityIcons name="dumbbell" size={18} color={color} />,
          },
          {
            value: 'programs',
            label: 'Browse Splits',
            icon: (color) => <Feather name="layers" size={17} color={color} />,
          },
        ]}
        value={tab}
        onChange={setTab}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
      />

      {tab === 'programs' ? (
        <View style={styles.libraryTab}>
          {error ? (
            <Text testID="workout-splits-error" style={styles.errorText}>
              {error}
            </Text>
          ) : null}
          <SplitsHeading label="Workout Programs" accentColor={theme.accent} />
          {programsCard}
          {PROGRAMS_OPEN ? (
            <View style={styles.sectionGap}>
              <ProgramBrowser
                testID="workout-splits-programs"
                preferences={preferences}
                chosen={null}
                onOpen={(choice) => navigation.navigate('ProgramDetail', choice)}
                onEditHomeEquipment={() => navigation.navigate('SettingsWorkoutPreferences')}
                recommendationsPrompt={
                  noPreferences ? (
                    <AppCard>
                      <ListRow
                        testID="workout-splits-preferences"
                        icon="sliders"
                        title="Get recommendations"
                        subtitle="Tell us what to prioritize and where you train."
                        onPress={() => navigation.navigate('SettingsWorkoutPreferences')}
                      />
                    </AppCard>
                  ) : undefined
                }
              />
            </View>
          ) : null}
          <View style={styles.sectionGap}>
            <SplitsHeading
              testID="workout-splits-browse-heading"
              label="Browse Splits"
              accentColor={theme.accent}
            />
          </View>
          <View testID="workout-splits-presets" style={styles.cardStack}>
            {presetCards(WORKOUT_SPLIT_PRESETS)}
          </View>
        </View>
      ) : (
        <>
          {error ? (
            <Text testID="workout-splits-error" style={styles.errorText}>
              {error}
            </Text>
          ) : null}

          <View style={styles.firstHeading}>
            <SplitsHeading
              testID="workout-splits-heading-mine"
              label="My Workout Splits"
              accentColor={theme.accent}
            />
          </View>
          {splits.length === 0 ? (
            <EmptyState
              testID="workout-splits-empty"
              title="Create a split to plan your training days."
            />
          ) : (
            ordered.map((split) => (
              <SplitCard
                key={split.id}
                split={split}
                active={split.id === activeId}
                busy={busySplitId === split.id}
                accentColor={theme.accent}
                onAccentColor={theme.onAccent}
                onOpen={() => navigation.navigate('WorkoutSplitView', { splitId: split.id })}
                onActivate={() => confirmSelectActive(split)}
                onEdit={() => navigation.navigate('WorkoutSplitForm', { splitId: split.id })}
                onDuplicate={() => void handleDuplicate(split)}
                onDelete={() => confirmDelete(split)}
              />
            ))
          )}

          <View style={styles.createWrap}>
            <PrimaryButton
              testID="workout-splits-create"
              label="Create Workout Split"
              icon="plus-circle"
              onPress={() => navigation.navigate('WorkoutSplitForm', {})}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
          </View>

          <View style={styles.sectionGap}>
            <SplitsHeading
              label="Workout Programs"
              accentColor={theme.accent}
              action={
                PROGRAMS_OPEN
                  ? {
                      label: 'View All',
                      onPress: () => setTab('programs'),
                      testID: 'workout-splits-programs-all',
                    }
                  : undefined
              }
            />
          </View>
          {programsCard}

          <View style={styles.sectionGap}>
            <SplitsHeading
              testID="workout-splits-browse-heading"
              label="Browse Splits"
              accentColor={theme.accent}
              action={{
                label: 'View All',
                onPress: () => setTab('programs'),
                testID: 'workout-splits-browse-all',
              }}
            />
          </View>
          <View testID="workout-splits-presets" style={styles.cardStack}>
            {presetCards(WORKOUT_SPLIT_PRESETS.slice(0, MY_SPLITS_PRESETS))}
          </View>
        </>
      )}
    </Screen>
  );
}
