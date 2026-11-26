import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { colors } from '../design/theme';
import { EmptyState } from '../design/EmptyState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { Toggle } from '../design/Toggle';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { useProfile } from '../profile/ProfileProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { WorkoutSplitPresetPicker } from '../workouts/WorkoutSplitPresetPicker';
import { SegmentedControl } from '../design/SegmentedControl';
import { ProgramBrowser } from '../programs/ProgramBrowser';
import { ProgramsEntryCard } from '../programs/ProgramsEntryCard';
import { preferencesFromProfile } from '../programs/programPreferences';
import {
  deleteWorkoutSplit,
  duplicateWorkoutSplit,
  fetchWorkoutSplits,
  type WorkoutSplitSummary,
} from '../workouts/workoutSplitQueries';
import { workoutSplitStyles as styles } from './workoutSplitStyles';

type Props = RootStackScreenProps<'WorkoutSplits'>;

type Tab = 'splits' | 'programs';

// Two tabs under the header, read top to bottom. My Splits: the active split first (the hero
// card), then the rest of the person's splits, each its own widget -- tapping one opens its
// read-only view; Edit / Duplicate / Delete sit quietly beneath it inside the widget -- then
// "Create Workout Split", the one primary action, then the ways to find one: the Split Library
// (the other tab) and the ready-made presets. Split Library: Harbir's library of splits
// (programs/ProgramBrowser.tsx), with a way to tell us what to recommend from where Recommended
// for You goes while nothing's been said.
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

  // The active split first, the rest in the order they came.
  const activeSplit = splits.find((split) => split.id === activeId) ?? null;
  const ordered = activeSplit
    ? [activeSplit, ...splits.filter((split) => split.id !== activeId)]
    : splits;

  if (loading || themeLoading) {
    return <LoadingState testID="workout-splits-loading" />;
  }

  return (
    <Screen
      scrollTestID="workout-splits-scroll"
      contentContainerStyle={styles.listContent}
      header={
        <AppHeader
          testID="workout-splits-header"
          title="Workout Splits"
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
          { value: 'splits', label: 'My Splits' },
          { value: 'programs', label: 'Split Library' },
        ]}
        value={tab}
        onChange={setTab}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
      />

      {tab === 'programs' ? (
        <View style={styles.libraryTab}>
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
      ) : (
        <>
          {error ? (
            <Text testID="workout-splits-error" style={styles.errorText}>
              {error}
            </Text>
          ) : null}

          {splits.length === 0 ? (
            <EmptyState
              testID="workout-splits-empty"
              title="Create a split to plan your training days."
            />
          ) : (
            ordered.map((split, i) => {
              const isActive = split.id === activeId;
              const busy = busySplitId === split.id;
              // The active split under its own heading, the rest under one of theirs.
              const heading = isActive
                ? 'Active Split'
                : i === 0 || ordered[i - 1]!.id === activeId
                  ? activeSplit
                    ? 'Your Other Splits'
                    : 'Your Splits'
                  : null;
              return (
                <Fragment key={split.id}>
                  {heading ? (
                    <View style={[styles.presetsSectionWrap, i > 0 && styles.sectionGap]}>
                      <SectionHeader
                        testID={`workout-splits-heading-${isActive ? 'active' : 'others'}`}
                        label={heading}
                      />
                    </View>
                  ) : null}
                  <AppCard
                    testID={`workout-split-${split.id}`}
                    hero={isActive}
                    topAccent={isActive ? theme.accent : undefined}
                  >
                    <ListRow
                      testID={`workout-split-view-${split.id}`}
                      title={split.name}
                      onPress={() => navigation.navigate('WorkoutSplitView', { splitId: split.id })}
                      disabled={busy}
                      trailing={
                        <View style={styles.activeToggleWrap}>
                          {isActive ? (
                            <Text style={[styles.activeLabel, { color: theme.accent }]}>
                              ACTIVE
                            </Text>
                          ) : null}
                          <Toggle
                            testID={`workout-split-activate-${split.id}`}
                            value={isActive}
                            // Turning an inactive split's toggle on makes it the
                            // active one (same confirmation as before); the
                            // already-active split's own toggle is disabled --
                            // there's no "no split active at all" state today,
                            // only switching which one is active, so it can't be
                            // turned off in place, only superseded by another.
                            onValueChange={(next) => {
                              if (next) confirmSelectActive(split);
                            }}
                            accentColor={theme.accent}
                            onAccentColor={theme.onAccent}
                            accessibilityLabel={
                              isActive ? 'Active workout split' : 'Set as active split'
                            }
                            disabled={busy || isActive}
                          />
                        </View>
                      }
                    />
                    <View style={styles.splitActions}>
                      <TouchableOpacity
                        testID={`workout-split-edit-${split.id}`}
                        style={styles.splitAction}
                        onPress={() =>
                          navigation.navigate('WorkoutSplitForm', { splitId: split.id })
                        }
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityLabel="Edit split"
                        hitSlop={8}
                      >
                        <Feather name="edit-2" size={18} color={colors.textSecondary} />
                        <Text style={styles.splitActionLabel}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={`workout-split-duplicate-${split.id}`}
                        style={styles.splitAction}
                        onPress={() => handleDuplicate(split)}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityLabel="Duplicate split"
                        hitSlop={8}
                      >
                        <Feather name="copy" size={18} color={colors.textSecondary} />
                        <Text style={styles.splitActionLabel}>Duplicate</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={`workout-split-delete-${split.id}`}
                        style={styles.splitAction}
                        onPress={() => confirmDelete(split)}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityLabel="Delete split"
                        hitSlop={8}
                      >
                        <Feather name="trash-2" size={18} color={colors.destructive} />
                        <Text style={[styles.splitActionLabel, styles.splitActionDestructive]}>
                          Delete
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </AppCard>
                </Fragment>
              );
            })
          )}

          <View style={styles.createWrap}>
            <PrimaryButton
              testID="workout-splits-create"
              label="Create Workout Split"
              onPress={() => navigation.navigate('WorkoutSplitForm', {})}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
          </View>

          <View style={[styles.presetsSectionWrap, styles.sectionGap]}>
            <SectionHeader label="Find a Split" />
          </View>
          <ProgramsEntryCard testID="workout-splits-library" onPress={() => setTab('programs')} />

          <View style={[styles.presetsSectionWrap, styles.sectionGap]}>
            <SectionHeader label="Start From a Preset" />
          </View>
          <WorkoutSplitPresetPicker
            testID="workout-splits-presets"
            userId={userId}
            theme={theme}
            onPresetActivated={handlePresetActivated}
          />
        </>
      )}
    </Screen>
  );
}
