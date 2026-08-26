import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import {
  fetchExercises,
  type ExerciseRow,
  type ExerciseSource,
} from '../exercises/exerciseQueries';
import { MuscleGroupChips } from '../exercises/MuscleGroupChips';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import type { RootStackScreenProps } from '../navigation/types';
import { ExerciseFormScreen } from './ExerciseFormScreen';
import { exerciseStyles as styles } from './exerciseStyles';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

type Props = RootStackScreenProps<'ExerciseLibrary'>;

type Mode = { type: 'list' } | { type: 'create' } | { type: 'edit'; exercise: ExerciseRow };

const SOURCE_OPTIONS: { value: ExerciseSource; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'builtin', label: 'Built-in' },
  { value: 'mine', label: 'Mine' },
];

export function ExerciseLibraryScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
  const [source, setSource] = useState<ExerciseSource>('all');
  const [rows, setRows] = useState<ExerciseRow[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce free-text input before it drives a query, so every keystroke
  // doesn't fire its own request.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadPage = useCallback(
    async (targetPage: number, replace: boolean) => {
      if (!userId) return;
      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      try {
        const result = await fetchExercises({
          userId,
          search,
          muscleGroup,
          source,
          page: targetPage,
          pageSize: PAGE_SIZE,
        });
        setRows((prev) => (replace ? result.rows : [...prev, ...result.rows]));
        setHasMore(result.hasMore);
        setPage(targetPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load exercises');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [userId, search, muscleGroup, source],
  );

  // Re-fetch from the first page whenever a filter changes; loadPage
  // already captures the current search/muscleGroup/source/userId.
  useEffect(() => {
    void loadPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, search, muscleGroup, source]);

  function handleDone() {
    setMode({ type: 'list' });
    void loadPage(0, true);
  }

  if (mode.type === 'create') {
    return (
      <ExerciseFormScreen
        mode="create"
        onDone={handleDone}
        onCancel={() => setMode({ type: 'list' })}
      />
    );
  }

  if (mode.type === 'edit') {
    return (
      <ExerciseFormScreen
        mode="edit"
        exercise={mode.exercise}
        onDone={handleDone}
        onCancel={() => setMode({ type: 'list' })}
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.title}>Exercise Library</Text>
              <TouchableOpacity testID="exercise-library-back" onPress={() => navigation.goBack()}>
                <Text style={styles.backLink}>Back</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              testID="exercise-search"
              style={styles.input}
              placeholder="Search exercises"
              placeholderTextColor="#6B6B75"
              value={searchInput}
              onChangeText={setSearchInput}
            />

            <MuscleGroupChips value={muscleGroup} onChange={setMuscleGroup} includeAll />

            <View style={styles.sourceRow}>
              {SOURCE_OPTIONS.map((option) => {
                const selected = option.value === source;
                return (
                  <TouchableOpacity
                    key={option.value}
                    testID={`exercise-source-${option.value}`}
                    style={[styles.sourceOption, selected && styles.sourceOptionSelected]}
                    onPress={() => setSource(option.value)}
                  >
                    <Text
                      style={[styles.sourceOptionText, selected && styles.sourceOptionTextSelected]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              testID="exercise-create-button"
              style={styles.createButton}
              onPress={() => setMode({ type: 'create' })}
            >
              <Text style={styles.createButtonText}>New Exercise</Text>
            </TouchableOpacity>

            {error ? (
              <Text testID="exercise-library-error" style={styles.error}>
                {error}
              </Text>
            ) : null}

            {loading ? (
              <ActivityIndicator testID="exercise-library-loading" size="large" color="#FFFFFF" />
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const isMine = item.createdBy === userId;
          return (
            <TouchableOpacity
              testID={`exercise-item-${item.id}`}
              style={styles.listItem}
              disabled={!isMine}
              onPress={() => isMine && setMode({ type: 'edit', exercise: item })}
            >
              <View>
                <Text style={styles.listItemName}>{item.name}</Text>
                <Text style={styles.listItemMeta}>{MUSCLE_GROUP_LABELS[item.muscleGroup]}</Text>
              </View>
              <Text style={styles.listItemBadge}>{item.createdBy ? 'Custom' : 'Built-in'}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !loading ? <Text style={styles.emptyText}>No exercises found</Text> : null
        }
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity
              testID="exercise-load-more"
              style={styles.createButton}
              onPress={() => void loadPage(page + 1, false)}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator color="#0B0B0F" />
              ) : (
                <Text style={styles.createButtonText}>Load More</Text>
              )}
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}
