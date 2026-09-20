import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { TextInput } from '../design/TextInput';
import { colors } from '../design/theme';
import {
  fetchExerciseSourceCounts,
  fetchExercises,
  type ExerciseRow,
  type ExerciseSource,
  type ExerciseSourceCounts,
} from '../exercises/exerciseQueries';
import { MuscleGroupChips } from '../exercises/MuscleGroupChips';
import { MOVEMENT_TYPE_LABELS } from '../exercises/movementTypes';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { ExerciseFormScreen } from './ExerciseFormScreen';
import { exerciseLibraryStyles as styles } from './exerciseLibraryStyles';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

type Props = RootStackScreenProps<'ExerciseLibrary'>;

type Mode = { type: 'list' } | { type: 'create' } | { type: 'edit'; exercise: ExerciseRow };

const SOURCE_OPTIONS: {
  value: ExerciseSource;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { value: 'all', label: 'All', icon: 'grid' },
  { value: 'builtin', label: 'Built-in', icon: 'award' },
  { value: 'mine', label: 'Mine', icon: 'star' },
];

// The Workout Mode "browse every exercise" screen -- built-ins plus the
// user's own custom exercises, searchable/filterable/sortable, text-only
// (no exercise artwork -- Progresso has none, and none is added here).
// Business logic (search/filter/pagination/create/edit) is unchanged from
// before this pass; only presentation and the two additions called out in
// their own comments below (ascending toggle, real per-source counts) are
// new, both minimal read-layer extensions of the existing query rather than
// new business logic.
export function ExerciseLibraryScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { openMenu } = useAppMenu();
  // "Progress" in the hook's own name is a holdover from its first caller --
  // it's really just "the user's Workout accent theme", already reused the
  // same way by WorkoutSplitsScreen for a non-Progress Workout-mode screen.
  const { theme } = useProgressTheme();

  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
  const [source, setSource] = useState<ExerciseSource>('all');
  const [ascending, setAscending] = useState(true);
  const [rows, setRows] = useState<ExerciseRow[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Real, independent per-source totals for the "All / Built-in / Mine"
  // category cards (see fetchExerciseSourceCounts) -- never fabricated, and
  // never derived from `rows`/`totalCount`, which only reflect the CURRENT
  // search/filter, not each category's own stable total. Null until the
  // first fetch resolves, so the cards show no number rather than a wrong
  // one in the meantime.
  const [sourceCounts, setSourceCounts] = useState<ExerciseSourceCounts | null>(null);

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
          ascending,
          page: targetPage,
          pageSize: PAGE_SIZE,
        });
        setRows((prev) => (replace ? result.rows : [...prev, ...result.rows]));
        setHasMore(result.hasMore);
        setTotalCount(result.totalCount);
        setPage(targetPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load exercises');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [userId, search, muscleGroup, source, ascending],
  );

  // Re-fetch from the first page whenever a filter changes; loadPage
  // already captures the current search/muscleGroup/source/ascending/userId.
  useEffect(() => {
    void loadPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, search, muscleGroup, source, ascending]);

  // The category cards' own totals -- independent of search/filter, so this
  // only needs to run once per mount, not on every filter change above.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchExerciseSourceCounts(userId)
      .then((counts) => {
        if (!cancelled) setSourceCounts(counts);
      })
      .catch(() => {
        if (!cancelled) setSourceCounts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

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
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
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
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
      />
    );
  }

  return (
    <View style={styles.screen} testID="exercise-library-screen">
      <AppHeader
        testID="exercise-library-header"
        title="Exercise Library"
        leftAction={{
          icon: 'menu',
          onPress: () => openMenu('workout'),
          accessibilityLabel: 'Open menu',
          testID: 'exercise-library-open-menu',
        }}
      />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.searchWrap}>
              <TextInput
                testID="exercise-search"
                placeholder="Search exercises..."
                value={searchInput}
                onChangeText={setSearchInput}
                autoCapitalize="none"
                leftAccessory={<Feather name="search" size={16} color={colors.textMuted} />}
              />
            </View>

            <View testID="exercise-library-muscle-group-wrap" style={styles.chipsWrap}>
              <MuscleGroupChips
                value={muscleGroup}
                onChange={setMuscleGroup}
                includeAll
                accentColor={theme.accent}
                onAccentColor={theme.onAccent}
              />
            </View>

            <View style={styles.categoryRow}>
              {SOURCE_OPTIONS.map((option) => {
                const selected = option.value === source;
                const count = sourceCounts?.[option.value === 'all' ? 'all' : option.value] ?? null;
                return (
                  <AppCard
                    key={option.value}
                    testID={`exercise-source-${option.value}`}
                    onPress={() => setSource(option.value)}
                    style={[
                      styles.categoryCard,
                      selected ? { borderWidth: 1, borderColor: theme.accent } : null,
                    ]}
                    accessibilityState={{ selected }}
                  >
                    <Feather
                      name={option.icon}
                      size={18}
                      color={selected ? theme.accent : colors.textSecondary}
                      style={styles.categoryCardIcon}
                    />
                    <Text
                      style={[styles.categoryCardLabel, selected ? { color: theme.accent } : null]}
                    >
                      {option.label}
                    </Text>
                    <Text
                      testID={`exercise-source-${option.value}-count`}
                      style={styles.categoryCardCount}
                    >
                      {count !== null ? `${count} exercises` : ' '}
                    </Text>
                  </AppCard>
                );
              })}
            </View>

            <View style={styles.countSortRow}>
              <Text testID="exercise-library-count" style={styles.countText}>
                {totalCount} {totalCount === 1 ? 'exercise' : 'exercises'}
              </Text>
              <TouchableOpacity
                testID="exercise-library-sort"
                style={styles.sortButton}
                onPress={() => setAscending((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel="Toggle sort order"
              >
                <Text style={styles.sortButtonText}>Sort: {ascending ? 'A → Z' : 'Z → A'}</Text>
                <Feather name="chevron-down" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="exercise-create-button"
              style={styles.loadMoreButton}
              onPress={() => setMode({ type: 'create' })}
            >
              <Text style={[styles.loadMoreText, { color: theme.accent }]}>+ New Exercise</Text>
            </TouchableOpacity>

            {error ? (
              <Text testID="exercise-library-error" style={styles.errorText}>
                {error}
              </Text>
            ) : null}

            {loading ? (
              <ActivityIndicator
                testID="exercise-library-loading"
                size="large"
                color={colors.textPrimary}
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const isMine = item.createdBy != null;
          return (
            <AppCard
              testID={`exercise-item-${item.id}`}
              style={styles.exerciseRow}
              onPress={isMine ? () => setMode({ type: 'edit', exercise: item }) : undefined}
            >
              <View style={styles.exerciseRowLeft}>
                <Text style={styles.exerciseName}>{item.name}</Text>
                <View style={styles.exerciseTagsRow}>
                  <View style={styles.exerciseTag}>
                    <Text style={styles.exerciseTagText}>
                      {MUSCLE_GROUP_LABELS[item.muscleGroup]}
                    </Text>
                  </View>
                  <View style={styles.exerciseTag}>
                    <Text style={styles.exerciseTagText}>
                      {MOVEMENT_TYPE_LABELS[item.movementType]}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.exerciseRowRight}>
                <View
                  style={[
                    styles.sourceBadge,
                    { borderColor: isMine ? theme.accent : colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.sourceBadgeText,
                      { color: isMine ? theme.accent : colors.textSecondary },
                    ]}
                  >
                    {isMine ? 'Mine' : 'Built-in'}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </View>
            </AppCard>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <Text testID="exercise-library-empty" style={styles.emptyText}>
              No exercises found
            </Text>
          ) : null
        }
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity
              testID="exercise-load-more"
              style={styles.loadMoreButton}
              onPress={() => void loadPage(page + 1, false)}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator color={colors.textSecondary} />
              ) : (
                <Text style={styles.loadMoreText}>Load More</Text>
              )}
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}
