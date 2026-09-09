import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { EmptyState } from '../design/EmptyState';
import { LoadingState } from '../design/LoadingState';
import { colors } from '../design/theme';
import { updateMyProfile } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import {
  deleteWorkoutSplit,
  duplicateWorkoutSplit,
  fetchWorkoutSplits,
  type WorkoutSplitSummary,
} from '../workouts/workoutSplitQueries';
import { workoutSplitStyles as styles } from './workoutSplitStyles';

type Props = RootStackScreenProps<'WorkoutSplits'>;

// The "COD class selection"-inspired split picker: every saved split shown
// as a clear, selectable card, the active one obviously highlighted. A
// split only ever holds day names + muscle groups (see workoutSplitQueries.ts) --
// exercises are chosen when the workout is actually performed.
export function WorkoutSplitsScreen({ navigation }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const { theme, activeWorkoutSplitId, themeLoading } = useProgressTheme();
  const insets = useSafeAreaInsets();

  const [splits, setSplits] = useState<WorkoutSplitSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busySplitId, setBusySplitId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      setSplits(await fetchWorkoutSplits(userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workout splits');
    } finally {
      setLoading(false);
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
    if (!accessToken) return;
    setBusySplitId(split.id);
    try {
      await updateMyProfile(accessToken, { activeWorkoutSplitId: split.id });
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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} testID="workout-splits-scroll">
        <View style={styles.header}>
          <TouchableOpacity
            testID="workout-splits-back"
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back"
            accessibilityRole="button"
          >
            <Feather name="arrow-left" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Workout Splits</Text>
        </View>

        {error ? (
          <Text testID="workout-splits-error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        {splits.length === 0 ? (
          <EmptyState
            testID="workout-splits-empty"
            title="Create a split to plan your training days."
            icon={<Feather name="layers" size={24} color={colors.textMuted} />}
          />
        ) : (
          <View style={styles.list}>
            <Text style={styles.sectionLabel}>My Workout Splits</Text>
            {splits.map((split) => {
              const isActive = split.id === activeId;
              const busy = busySplitId === split.id;
              return (
                <AppCard
                  key={split.id}
                  testID={`workout-split-${split.id}`}
                  style={
                    isActive ? [styles.splitCard, { borderColor: theme.accent }] : styles.splitCard
                  }
                >
                  <TouchableOpacity
                    testID={`workout-split-view-${split.id}`}
                    onPress={() => navigation.navigate('WorkoutSplitView', { splitId: split.id })}
                    disabled={busy}
                    accessibilityRole="button"
                  >
                    <View style={styles.splitCardHeader}>
                      <Text style={styles.splitName}>{split.name}</Text>
                      {isActive ? (
                        <View style={[styles.activeBadge, { backgroundColor: theme.accentBg }]}>
                          <Feather name="check-circle" size={14} color={theme.accent} />
                          <Text style={[styles.activeBadgeText, { color: theme.accent }]}>
                            ACTIVE
                          </Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          testID={`workout-split-activate-${split.id}`}
                          style={styles.activateBadge}
                          onPress={() => confirmSelectActive(split)}
                          disabled={busy}
                          accessibilityRole="button"
                          accessibilityLabel="Set as active split"
                        >
                          <Feather name="circle" size={14} color={colors.textMuted} />
                          <Text style={styles.activateBadgeText}>Set Active</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>

                  <View style={styles.splitActionsRow}>
                    <TouchableOpacity
                      testID={`workout-split-edit-${split.id}`}
                      onPress={() => navigation.navigate('WorkoutSplitForm', { splitId: split.id })}
                    >
                      <Text style={styles.actionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`workout-split-duplicate-${split.id}`}
                      onPress={() => handleDuplicate(split)}
                      disabled={busy}
                    >
                      <Text style={styles.actionText}>Duplicate</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`workout-split-delete-${split.id}`}
                      onPress={() => confirmDelete(split)}
                      disabled={busy}
                    >
                      <Text style={styles.deleteActionText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </AppCard>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          testID="workout-splits-create"
          style={[styles.createButton, { backgroundColor: theme.accent }]}
          onPress={() => navigation.navigate('WorkoutSplitForm', {})}
        >
          <Feather name="plus" size={18} color={theme.onAccent} />
          <Text style={[styles.createButtonText, { color: theme.onAccent }]}>
            Create Workout Split
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
