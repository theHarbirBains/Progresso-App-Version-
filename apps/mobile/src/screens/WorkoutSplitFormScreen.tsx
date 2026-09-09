import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { LoadingState } from '../design/LoadingState';
import { colors } from '../design/theme';
import { updateMyProfile } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import {
  SPLIT_MUSCLE_GROUPS,
  SPLIT_MUSCLE_GROUP_LABELS,
  type SplitMuscleGroup,
} from '../workouts/splitMuscleGroups';
import {
  createWorkoutSplit,
  createWorkoutSplitDay,
  deleteWorkoutSplitDay,
  fetchWorkoutSplitDetail,
  renameWorkoutSplit,
  renameWorkoutSplitDay,
  reorderWorkoutSplitDays,
  setWorkoutSplitDayMuscleGroups,
  type WorkoutSplitDay,
} from '../workouts/workoutSplitQueries';
import { workoutSplitStyles as styles } from './workoutSplitStyles';

type Props = RootStackScreenProps<'WorkoutSplitForm'>;

// Create is just step one of edit: a brand-new split only needs a name, so
// this screen creates it immediately on that first save and switches itself
// into edit mode (via setParams) for day/muscle-group management -- rather
// than holding a whole draft split in local state and diffing it against
// the server on a single final "Save".
export function WorkoutSplitFormScreen({ navigation, route }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const { theme, themeLoading } = useProgressTheme();
  const insets = useSafeAreaInsets();
  const splitId = route.params?.splitId;
  const activateOnCreate = route.params?.activateOnCreate ?? false;

  const [loading, setLoading] = useState(Boolean(splitId));
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [splitName, setSplitName] = useState('');
  const [days, setDays] = useState<WorkoutSplitDay[]>([]);
  // The last name actually persisted per day (server-confirmed), separate
  // from `days` state itself -- so a day that's been typed blank (e.g. the
  // user selected-all-and-deleted before typing a replacement) can be
  // reverted to something real on blur instead of staying visibly blank
  // indefinitely (renaming to blank is never persisted -- see
  // handleRenameDay -- so leaving the display blank would misrepresent
  // what the server actually has).
  const confirmedDayNames = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!splitId) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchWorkoutSplitDetail(splitId);
      setSplitName(detail.name);
      setDays(detail.days);
      confirmedDayNames.current = Object.fromEntries(detail.days.map((d) => [d.id, d.name]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workout split');
    } finally {
      setLoading(false);
    }
  }, [splitId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!userId || !splitName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createWorkoutSplit(userId, splitName.trim());
      if (activateOnCreate && accessToken) {
        await updateMyProfile(accessToken, { activeWorkoutSplitId: created.id });
      }
      navigation.setParams({ splitId: created.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create split');
    } finally {
      setCreating(false);
    }
  }

  async function handleRenameSplit() {
    if (!splitId || !splitName.trim()) return;
    try {
      await renameWorkoutSplit(splitId, splitName.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename split');
    }
  }

  async function handleAddDay() {
    if (!splitId) return;
    try {
      const day = await createWorkoutSplitDay(splitId, `Day ${days.length + 1}`, days.length + 1);
      setDays((prev) => [...prev, day]);
      confirmedDayNames.current[day.id] = day.name;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add day');
    }
  }

  function updateDayNameLocally(dayId: string, name: string) {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, name } : d)));
  }

  async function handleRenameDay(dayId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      // A blank name is never persisted -- revert the display back to the
      // last confirmed name rather than leaving the field looking blank
      // (nothing was actually lost server-side).
      const confirmed = confirmedDayNames.current[dayId];
      if (confirmed !== undefined) updateDayNameLocally(dayId, confirmed);
      return;
    }
    try {
      await renameWorkoutSplitDay(dayId, trimmed);
      confirmedDayNames.current[dayId] = trimmed;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename day');
    }
  }

  async function handleRemoveDay(dayId: string) {
    try {
      await deleteWorkoutSplitDay(dayId);
      setDays((prev) => prev.filter((d) => d.id !== dayId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove day');
    }
  }

  async function handleMoveDay(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= days.length || !splitId) return;
    const reordered = [...days];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setDays(reordered);
    try {
      await reorderWorkoutSplitDays(
        splitId,
        reordered.map((d) => ({ id: d.id, name: d.name })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder days');
    }
  }

  async function handleToggleMuscleGroup(day: WorkoutSplitDay, group: SplitMuscleGroup) {
    const has = day.muscleGroups.includes(group);
    const nextGroups = has
      ? day.muscleGroups.filter((g) => g !== group)
      : [...day.muscleGroups, group];
    setDays((prev) => prev.map((d) => (d.id === day.id ? { ...d, muscleGroups: nextGroups } : d)));
    try {
      await setWorkoutSplitDayMuscleGroups(day.id, nextGroups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update muscle groups');
    }
  }

  if (loading || themeLoading) {
    return <LoadingState testID="workout-split-form-loading" />;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        testID="workout-split-form-scroll"
      >
        <View style={styles.header}>
          <TouchableOpacity
            testID="workout-split-form-back"
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back"
            accessibilityRole="button"
          >
            <Feather name="arrow-left" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{splitId ? 'Edit Split' : 'Create Workout Split'}</Text>
        </View>

        {error ? (
          <Text testID="workout-split-form-error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        <Text style={styles.label}>Split Name</Text>
        <TextInput
          testID="workout-split-form-name"
          style={styles.input}
          placeholder="My Training"
          placeholderTextColor={colors.textMuted}
          value={splitName}
          onChangeText={setSplitName}
          onBlur={splitId ? handleRenameSplit : undefined}
        />

        {!splitId ? (
          <TouchableOpacity
            testID="workout-split-form-create"
            style={[styles.createButton, { backgroundColor: theme.accent, marginTop: 20 }]}
            onPress={handleCreate}
            disabled={creating || !splitName.trim()}
          >
            {creating ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <Text style={[styles.createButtonText, { color: theme.onAccent }]}>Create Split</Text>
            )}
          </TouchableOpacity>
        ) : (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Workout Days</Text>
            {days.map((day, index) => (
              <AppCard key={day.id} testID={`workout-split-day-${day.id}`} style={styles.dayCard}>
                <View style={styles.dayHeaderRow}>
                  <TextInput
                    testID={`workout-split-day-name-${day.id}`}
                    style={styles.dayInput}
                    value={day.name}
                    onChangeText={(text) => updateDayNameLocally(day.id, text)}
                    onBlur={() => handleRenameDay(day.id, day.name)}
                  />
                  <TouchableOpacity
                    testID={`workout-split-day-up-${day.id}`}
                    style={styles.dayReorderButton}
                    onPress={() => handleMoveDay(index, -1)}
                    disabled={index === 0}
                  >
                    <Feather
                      name="arrow-up"
                      size={16}
                      color={index === 0 ? colors.textMuted : colors.textPrimary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`workout-split-day-down-${day.id}`}
                    style={styles.dayReorderButton}
                    onPress={() => handleMoveDay(index, 1)}
                    disabled={index === days.length - 1}
                  >
                    <Feather
                      name="arrow-down"
                      size={16}
                      color={index === days.length - 1 ? colors.textMuted : colors.textPrimary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`workout-split-day-remove-${day.id}`}
                    style={styles.dayReorderButton}
                    onPress={() => handleRemoveDay(day.id)}
                  >
                    <Feather name="trash-2" size={16} color={colors.destructive} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Muscle Groups</Text>
                <View style={styles.muscleChipRow}>
                  {SPLIT_MUSCLE_GROUPS.map((group) => {
                    const selected = day.muscleGroups.includes(group);
                    return (
                      <TouchableOpacity
                        key={group}
                        testID={`workout-split-day-${day.id}-muscle-${group}`}
                        style={[
                          styles.muscleChip,
                          selected && { backgroundColor: theme.accent, borderColor: theme.accent },
                        ]}
                        onPress={() => handleToggleMuscleGroup(day, group)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text
                          style={[styles.muscleChipText, selected && { color: theme.onAccent }]}
                        >
                          {SPLIT_MUSCLE_GROUP_LABELS[group]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </AppCard>
            ))}

            <TouchableOpacity
              testID="workout-split-form-add-day"
              style={styles.addDayButton}
              onPress={handleAddDay}
            >
              <Text style={styles.addDayButtonText}>+ Add Workout Day</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="workout-split-form-done"
              style={[styles.createButton, { backgroundColor: theme.accent, marginTop: 20 }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={[styles.createButtonText, { color: theme.onAccent }]}>
                {activateOnCreate ? 'Create Split' : 'Done'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
