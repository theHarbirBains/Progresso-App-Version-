import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
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

const SOURCE_OPTIONS: { value: ExerciseSource; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'builtin', label: 'Built-in' },
  { value: 'mine', label: 'Mine' },
];

// The Workout Mode "browse every exercise" screen -- built-ins plus the
// user's own custom exercises, searchable/filterable/sortable, text-only
// (no exercise artwork -- Progresso has none, and none is added here).
//
// Layout: two widgets `widgetGap` apart. The browse widget holds search, the
// muscle filter and an All / Built-in / Mine block row with the real
// per-source totals; the list widget holds the count and sort control, then the
// exercises as rows (name, "Muscle · Movement", and a quiet Built-in/Mine
// marker). New Exercise is the header's "+". Your own exercises open for
// editing; built-ins are read-only.
// Search/filter/pagination/create/edit logic is unchanged.
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
    <Screen
      contentContainerStyle={styles.content}
      testID="exercise-library-screen"
      header={
        <AppHeader
          testID="exercise-library-header"
          title="Exercise Library"
          leftAction={{
            icon: 'menu',
            onPress: () => openMenu(),
            accessibilityLabel: 'Open menu',
            testID: 'exercise-library-open-menu',
          }}
          rightAction={{
            icon: 'plus',
            onPress: () => setMode({ type: 'create' }),
            accessibilityLabel: 'New Exercise',
            testID: 'exercise-create-button',
          }}
        />
      }
    >
      <AppCard testID="exercise-library-browse">
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

        <View style={styles.sourceTabs}>
          {SOURCE_OPTIONS.map((option) => {
            const selected = option.value === source;
            const count = sourceCounts?.[option.value] ?? null;
            return (
              <TouchableOpacity
                key={option.value}
                testID={`exercise-source-${option.value}`}
                style={[
                  styles.sourceTab,
                  selected ? { backgroundColor: theme.accentBg, borderColor: theme.accent } : null,
                ]}
                onPress={() => setSource(option.value)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={
                  count !== null ? `${option.label}, ${count} exercises` : option.label
                }
                accessibilityState={{ selected }}
              >
                <Text style={[styles.sourceTabLabel, selected ? { color: theme.accent } : null]}>
                  {option.label}
                </Text>
                <Text
                  testID={`exercise-source-${option.value}-count`}
                  style={styles.sourceTabCount}
                >
                  {count !== null ? String(count) : ' '}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </AppCard>

      <AppCard testID="exercise-library-list">
        <View style={styles.countSortRow}>
          <Text testID="exercise-library-count" style={styles.countText}>
            {totalCount} {totalCount === 1 ? 'exercise' : 'exercises'}
          </Text>
          <TextButton
            testID="exercise-library-sort"
            label={`Sort: ${ascending ? 'A → Z' : 'Z → A'}`}
            accessibilityLabel="Toggle sort order"
            onPress={() => setAscending((prev) => !prev)}
          />
        </View>

        {error ? (
          <Text testID="exercise-library-error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              testID="exercise-library-loading"
              size="large"
              color={colors.textPrimary}
            />
          </View>
        ) : null}

        {rows.map((item, index) => {
          const isMine = item.createdBy != null;
          return (
            <ListRow
              key={item.id}
              testID={`exercise-item-${item.id}`}
              title={item.name}
              subtitle={`${MUSCLE_GROUP_LABELS[item.muscleGroup]} · ${MOVEMENT_TYPE_LABELS[item.movementType]}`}
              divider={index > 0}
              onPress={isMine ? () => setMode({ type: 'edit', exercise: item }) : undefined}
              trailing={
                <>
                  <Text
                    style={[
                      styles.sourceLabel,
                      { color: isMine ? theme.accent : colors.textMuted },
                    ]}
                  >
                    {isMine ? 'Mine' : 'Built-in'}
                  </Text>
                  {isMine ? (
                    <Feather name="chevron-right" size={18} color={colors.textMuted} />
                  ) : null}
                </>
              }
            />
          );
        })}

        {!loading && rows.length === 0 ? (
          <EmptyState testID="exercise-library-empty" title="No exercises found" />
        ) : null}

        {hasMore ? (
          <TextButton
            testID="exercise-load-more"
            label="Load More"
            loading={loadingMore}
            onPress={() => void loadPage(page + 1, false)}
          />
        ) : null}
      </AppCard>
    </Screen>
  );
}
