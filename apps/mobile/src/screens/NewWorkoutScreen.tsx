import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { fetchExercises, type ExerciseRow } from '../exercises/exerciseQueries';
import { MuscleGroupChips } from '../exercises/MuscleGroupChips';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import type { RootStackScreenProps } from '../navigation/types';
import {
  addExerciseToWorkout,
  createWorkout,
  type WorkoutSummary,
} from '../workouts/workoutQueries';
import { workoutStyles as styles } from './workoutStyles';

const SEARCH_DEBOUNCE_MS = 300;
const PICKER_PAGE_SIZE = 20;

type Props = RootStackScreenProps<'NewWorkout'>;

// Exercises are named, added, reordered, and removed entirely in local
// state here before the workout ever exists in the database -- "Start
// Workout" is the single point where the workout and its exercises are
// actually persisted, in final order. This is why reordering never needs
// the bulk-upsert mechanism workoutQueries.reorderExercises provides (that
// exists for reordering *already-persisted* rows, verified at the database
// level, and is available for a future phase to use).
export function NewWorkoutScreen({ navigation }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;

  const [name, setName] = useState('');
  const [selected, setSelected] = useState<ExerciseRow[]>([]);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
  const [pickerRows, setPickerRows] = useState<ExerciseRow[]>([]);
  const [pickerLoading, setPickerLoading] = useState(true);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<WorkoutSummary | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setPickerLoading(true);
    fetchExercises({
      userId,
      search,
      muscleGroup,
      source: 'all',
      page: 0,
      pageSize: PICKER_PAGE_SIZE,
    })
      .then((result) => {
        if (!cancelled) setPickerRows(result.rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load exercises');
      })
      .finally(() => {
        if (!cancelled) setPickerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, search, muscleGroup]);

  function addToSelection(exercise: ExerciseRow) {
    setSelected((prev) => (prev.some((e) => e.id === exercise.id) ? prev : [...prev, exercise]));
  }

  function removeFromSelection(exerciseId: string) {
    setSelected((prev) => prev.filter((e) => e.id !== exerciseId));
  }

  function moveSelection(index: number, direction: -1 | 1) {
    setSelected((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleStart() {
    if (!userId || !accessToken || !name.trim() || selected.length === 0) return;
    setError(null);
    setConflict(null);
    setStarting(true);
    try {
      const result = await createWorkout(userId, name.trim());
      if (result.type === 'conflict') {
        setConflict(result.existingWorkout);
        return;
      }
      for (let i = 0; i < selected.length; i++) {
        await addExerciseToWorkout(result.workout.id, selected[i].id, i + 1);
      }
      navigation.replace('ActiveWorkout', { workoutId: result.workout.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start workout');
    } finally {
      setStarting(false);
    }
  }

  const canStart = name.trim().length > 0 && selected.length > 0 && !starting;

  return (
    <View style={styles.container}>
      <FlatList
        data={pickerRows}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.title}>New Workout</Text>
              <TouchableOpacity testID="new-workout-back" onPress={() => navigation.goBack()}>
                <Text style={styles.backLink}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              testID="new-workout-name"
              style={styles.input}
              placeholder="Workout name"
              placeholderTextColor="#6B6B75"
              value={name}
              onChangeText={setName}
            />

            {selected.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.label}>Exercises ({selected.length})</Text>
                {selected.map((exercise, index) => (
                  <View key={exercise.id} style={styles.setRow}>
                    <Text style={styles.listItemTitle}>{exercise.name}</Text>
                    <View style={styles.reorderRow}>
                      <TouchableOpacity
                        testID={`move-up-${exercise.id}`}
                        onPress={() => moveSelection(index, -1)}
                        disabled={index === 0}
                      >
                        <Text style={styles.reorderButtonText}>{index === 0 ? '' : 'Up'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={`move-down-${exercise.id}`}
                        onPress={() => moveSelection(index, 1)}
                        disabled={index === selected.length - 1}
                      >
                        <Text style={styles.reorderButtonText}>
                          {index === selected.length - 1 ? '' : 'Down'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={`remove-selected-${exercise.id}`}
                        onPress={() => removeFromSelection(exercise.id)}
                      >
                        <Text style={styles.setDeleteText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {conflict ? (
              <View style={styles.banner}>
                <Text style={styles.bannerTitle}>
                  You already have an active workout: &quot;{conflict.name}&quot;
                </Text>
                <TouchableOpacity
                  testID="resume-instead"
                  style={styles.button}
                  onPress={() => navigation.replace('ActiveWorkout', { workoutId: conflict.id })}
                >
                  <Text style={styles.buttonText}>Resume It Instead</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {error ? (
              <Text testID="new-workout-error" style={styles.error}>
                {error}
              </Text>
            ) : null}

            <TouchableOpacity
              testID="start-workout"
              style={[styles.button, !canStart && styles.buttonDisabled]}
              onPress={handleStart}
              disabled={!canStart}
            >
              {starting ? (
                <ActivityIndicator color="#0B0B0F" />
              ) : (
                <Text style={styles.buttonText}>Start Workout</Text>
              )}
            </TouchableOpacity>

            <Text style={[styles.label, { marginTop: 20 }]}>Add exercises</Text>
            <TextInput
              testID="new-workout-exercise-search"
              style={styles.input}
              placeholder="Search exercises"
              placeholderTextColor="#6B6B75"
              value={searchInput}
              onChangeText={setSearchInput}
            />
            <MuscleGroupChips value={muscleGroup} onChange={setMuscleGroup} includeAll />
            {pickerLoading ? (
              <ActivityIndicator testID="exercise-picker-loading" size="large" color="#FFFFFF" />
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = selected.some((e) => e.id === item.id);
          return (
            <TouchableOpacity
              testID={`picker-exercise-${item.id}`}
              style={styles.listItem}
              onPress={() => addToSelection(item)}
              disabled={isSelected}
            >
              <Text style={styles.listItemTitle}>
                {item.name}
                {isSelected ? ' (added)' : ''}
              </Text>
              <Text style={styles.listItemMeta}>{MUSCLE_GROUP_LABELS[item.muscleGroup]}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !pickerLoading ? <Text style={styles.emptyText}>No exercises found</Text> : null
        }
      />
    </View>
  );
}
