import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { Screen } from '../design/Screen';
import {
  fetchAllExercises,
  fetchExerciseSourceCounts,
  type ExerciseRow,
  type ExerciseSource,
  type ExerciseSourceCounts,
} from '../exercises/exerciseQueries';
import { ExerciseBrowser } from '../exercises/ExerciseBrowser';
import { type MuscleGroup } from '../exercises/muscleGroups';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { ExerciseFormScreen } from './ExerciseFormScreen';
import { exerciseLibraryStyles as styles } from './exerciseLibraryStyles';

const SEARCH_DEBOUNCE_MS = 300;

type Props = RootStackScreenProps<'ExerciseLibrary'>;

type Mode = { type: 'list' } | { type: 'create' } | { type: 'edit'; exercise: ExerciseRow };

// The Workout Mode "browse every exercise" screen -- built-ins plus the
// user's own custom exercises, searchable/filterable, sectioned
// alphabetically (A-Z, like iOS Contacts) -- always A-Z, since this loads
// everything matching the current filters rather than paging (see
// fetchAllExercises).
//
// Layout: two widgets `widgetGap` apart. The browse widget holds search, the
// muscle filter and an All / Built-in / Mine block row with the real
// per-source totals; the list widget holds the count, then the exercises as
// rows under letter headings -- each with its machine photo (or a plain
// initial, "like a contact photo" -- see ExercisePhoto), name,
// "Muscle · Movement", and a quiet Built-in/Mine marker. New Exercise is the
// header's "+". Your own exercises open for editing; built-ins are
// read-only.
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
  const [rows, setRows] = useState<ExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Real, independent per-source totals for the "All / Built-in / Mine"
  // category cards (see fetchExerciseSourceCounts) -- never fabricated, and
  // never derived from `rows`, which only reflects the CURRENT search/filter,
  // not each category's own stable total. Null until the first fetch
  // resolves, so the cards show no number rather than a wrong one meanwhile.
  const [sourceCounts, setSourceCounts] = useState<ExerciseSourceCounts | null>(null);

  // Debounce free-text input before it drives a query, so every keystroke
  // doesn't fire its own request.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAllExercises({ userId, search, muscleGroup, source });
      setRows(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exercises');
    } finally {
      setLoading(false);
    }
  }, [userId, search, muscleGroup, source]);

  useEffect(() => {
    void load();
  }, [load]);

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
    void load();
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
      scroll={false}
      padded={false}
      testID="exercise-library-screen"
      contentContainerStyle={styles.page}
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
      <ExerciseBrowser
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        muscleGroup={muscleGroup}
        onMuscleGroupChange={setMuscleGroup}
        source={source}
        onSourceChange={setSource}
        sourceCounts={sourceCounts}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        accent={{ color: theme.accent, background: theme.accentBg, onColor: theme.onAccent }}
        onOpenMine={(exercise) => setMode({ type: 'edit', exercise })}
        testID="exercise-library"
      />
    </Screen>
  );
}
