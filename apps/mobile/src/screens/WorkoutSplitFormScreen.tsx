import { useCallback, useEffect, useRef, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { IconButton } from '../design/IconButton';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { TextInput } from '../design/TextInput';
import { colors } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { useProfile } from '../profile/ProfileProvider';
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
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { theme, themeLoading } = useProgressTheme();
  const { updateProfile } = useProfile();
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
      if (activateOnCreate) {
        await updateProfile({ activeWorkoutSplitId: created.id });
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
    <Screen
      keyboardAvoiding
      scrollTestID="workout-split-form-scroll"
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          title={splitId ? 'Edit Split' : 'Create Workout Split'}
          leftAction={{
            icon: 'arrow-left',
            onPress: () => navigation.goBack(),
            accessibilityLabel: 'Back',
            testID: 'workout-split-form-back',
          }}
        />
      }
    >
      {error ? (
        <Text testID="workout-split-form-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      <TextInput
        testID="workout-split-form-name"
        label="Split Name"
        placeholder="My Training"
        value={splitName}
        onChangeText={setSplitName}
        onBlur={splitId ? handleRenameSplit : undefined}
      />

      {!splitId ? (
        <PrimaryButton
          testID="workout-split-form-create"
          label="Create Split"
          onPress={handleCreate}
          loading={creating}
          disabled={!splitName.trim()}
          accentColor={theme.accent}
          onAccentColor={theme.onAccent}
        />
      ) : (
        <>
          <Section title="Workout Days">
            {days.map((day, index) => (
              <View
                key={day.id}
                testID={`workout-split-day-${day.id}`}
                style={[styles.dayBlock, index > 0 && styles.dayDivider]}
              >
                <View style={styles.formDayHeader}>
                  <View style={styles.formDayName}>
                    <TextInput
                      testID={`workout-split-day-name-${day.id}`}
                      value={day.name}
                      onChangeText={(text) => updateDayNameLocally(day.id, text)}
                      onBlur={() => handleRenameDay(day.id, day.name)}
                      accessibilityLabel={`Day ${index + 1} name`}
                    />
                  </View>
                  <IconButton
                    testID={`workout-split-day-up-${day.id}`}
                    icon="arrow-up"
                    accessibilityLabel="Move day up"
                    onPress={() => handleMoveDay(index, -1)}
                    disabled={index === 0}
                  />
                  <IconButton
                    testID={`workout-split-day-down-${day.id}`}
                    icon="arrow-down"
                    accessibilityLabel="Move day down"
                    onPress={() => handleMoveDay(index, 1)}
                    disabled={index === days.length - 1}
                  />
                  <IconButton
                    testID={`workout-split-day-remove-${day.id}`}
                    icon="trash-2"
                    accessibilityLabel="Remove day"
                    color={colors.destructive}
                    onPress={() => handleRemoveDay(day.id)}
                  />
                </View>

                <Text style={styles.fieldLabel}>Muscle Groups</Text>
                <View style={styles.chipRow}>
                  {SPLIT_MUSCLE_GROUPS.map((group) => {
                    const selected = day.muscleGroups.includes(group);
                    return (
                      <TouchableOpacity
                        key={group}
                        testID={`workout-split-day-${day.id}-muscle-${group}`}
                        style={[
                          styles.chip,
                          selected && { backgroundColor: theme.accent, borderColor: theme.accent },
                        ]}
                        onPress={() => handleToggleMuscleGroup(day, group)}
                        activeOpacity={0.8}
                        hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.chipText, selected && { color: theme.onAccent }]}>
                          {SPLIT_MUSCLE_GROUP_LABELS[group]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </Section>

          <SecondaryButton
            testID="workout-split-form-add-day"
            label="+ Add Workout Day"
            onPress={handleAddDay}
          />

          <PrimaryButton
            testID="workout-split-form-done"
            label={activateOnCreate ? 'Create Split' : 'Done'}
            onPress={() => navigation.goBack()}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        </>
      )}
    </Screen>
  );
}
