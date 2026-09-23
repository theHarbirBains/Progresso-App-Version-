import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { useProfile } from '../profile/ProfileProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import {
  deleteWorkoutSplit,
  duplicateWorkoutSplit,
  fetchWorkoutSplits,
  type WorkoutSplitSummary,
} from '../workouts/workoutSplitQueries';
import { workoutSplitStyles as styles } from './workoutSplitStyles';

type Props = RootStackScreenProps<'WorkoutSplits'>;

// Every saved split as its own widget, the active one the hero card. A split
// only ever holds day names + muscle groups (see workoutSplitQueries.ts) --
// exercises are chosen when the workout is actually performed. Tapping a split
// opens its read-only view; Edit / Duplicate / Delete sit quietly beneath it
// inside the widget, and "Create Workout Split" is the one primary action.
export function WorkoutSplitsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { theme, activeWorkoutSplitId, themeLoading } = useProgressTheme();
  const { updateProfile } = useProfile();
  const { openMenu } = useAppMenu();

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

  useEffect(() => {
    load();
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
        splits.map((split) => {
          const isActive = split.id === activeId;
          const busy = busySplitId === split.id;
          return (
            <AppCard
              key={split.id}
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
                  isActive ? (
                    <Text style={[styles.activeLabel, { color: theme.accent }]}>ACTIVE</Text>
                  ) : (
                    <TextButton
                      testID={`workout-split-activate-${split.id}`}
                      label="Set Active"
                      accessibilityLabel="Set as active split"
                      onPress={() => confirmSelectActive(split)}
                      disabled={busy}
                    />
                  )
                }
              />
              <View style={styles.splitActions}>
                <TextButton
                  testID={`workout-split-edit-${split.id}`}
                  label="Edit"
                  onPress={() => navigation.navigate('WorkoutSplitForm', { splitId: split.id })}
                />
                <TextButton
                  testID={`workout-split-duplicate-${split.id}`}
                  label="Duplicate"
                  onPress={() => handleDuplicate(split)}
                  disabled={busy}
                />
                <TextButton
                  testID={`workout-split-delete-${split.id}`}
                  label="Delete"
                  destructive
                  onPress={() => confirmDelete(split)}
                  disabled={busy}
                />
              </View>
            </AppCard>
          );
        })
      )}

      <PrimaryButton
        testID="workout-splits-create"
        label="Create Workout Split"
        onPress={() => navigation.navigate('WorkoutSplitForm', {})}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
      />
    </Screen>
  );
}
