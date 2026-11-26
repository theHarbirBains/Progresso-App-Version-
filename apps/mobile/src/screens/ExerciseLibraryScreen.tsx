import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { Screen } from '../design/Screen';
import {
  fetchAllExercises,
  fetchExerciseSourceCounts,
  invalidateExerciseCache,
  type ExerciseRow,
  type ExerciseSource,
  type ExerciseSourceCounts,
} from '../exercises/exerciseQueries';
import { ExerciseBrowser } from '../exercises/ExerciseBrowser';
import { sharingFriends } from '../exercises/sharingFriends';
import { useSharedExercises } from '../exercises/useSharedExercises';
import type { Equipment } from '../exercises/equipment';
import { type MuscleGroup } from '../exercises/muscleGroups';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { updateExercise } from '../lib/api';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { ExerciseFormScreen } from './ExerciseFormScreen';
import { exerciseLibraryStyles as styles } from './exerciseLibraryStyles';

type Props = RootStackScreenProps<'ExerciseLibrary'>;

type Mode =
  { type: 'list' } | { type: 'create'; name?: string } | { type: 'edit'; exercise: ExerciseRow };

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
// header's "+". Every exercise opens its page (ProgressExerciseDetail) --
// its top sets, best performances and journey; your own also have a pencil
// that opens them for editing, and swipe left to delete. Built-ins are
// otherwise read-only. Libraries are shared: a trainer's and their clients'
// exercises show in All (marked Trainer or Client), and the people you
// follow's in Friends -- with a filter by friend, and no count -- each with a plus that adds it
// to your own library.
export function ExerciseLibraryScreen({ navigation }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const { openMenu } = useAppMenu();
  // "Progress" in the hook's own name is a holdover from its first caller --
  // it's really just "the user's Workout accent theme", already reused the
  // same way by WorkoutSplitsScreen for a non-Progress Workout-mode screen.
  const { theme } = useProgressTheme();

  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput);
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [source, setSource] = useState<ExerciseSource>('all');
  const [rows, setRows] = useState<ExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Once the list has shown, a change of filter keeps it on screen until the new rows are in (they
  // come from memory, at once) -- swapping it for placeholders would rebuild every row and picture.
  const listShown = useRef(false);
  // The source the rows on screen were read for: while it differs from what's chosen, the list
  // fades softly (ExerciseBrowser's `updating`). Only the newest read is kept.
  const [readFor, setReadFor] = useState<{ source: ExerciseSource }>({ source: 'all' });
  const readNumber = useRef(0);
  const [error, setError] = useState<string | null>(null);
  // Real, independent per-source totals for the "All / Built-in / Mine"
  // category cards (see fetchExerciseSourceCounts) -- never fabricated, and
  // never derived from `rows`, which only reflects the CURRENT search/filter,
  // not each category's own stable total. Null until the first fetch
  // resolves, so the cards show no number rather than a wrong one meanwhile.
  const [sourceCounts, setSourceCounts] = useState<ExerciseSourceCounts | null>(null);
  // What the user's trainer, clients and the people they follow share, read as the page opens.
  const shared = useSharedExercises(true);
  const sharedRows = shared.rows;
  const friends = useMemo(() => sharingFriends(sharedRows), [sharedRows]);

  const load = useCallback(async () => {
    if (!userId) return;
    if (!listShown.current) setLoading(true);
    setError(null);
    const thisRead = ++readNumber.current;
    try {
      const result = await fetchAllExercises({
        userId,
        search,
        // The muscle, equipment and movement filters are applied in the list itself
        // (ExerciseBrowser), from these rows.
        muscleGroup: null,
        source,
        shared: sharedRows,
      });
      if (thisRead !== readNumber.current) return;
      const show = () => {
        setRows(result);
        setReadFor({ source });
      };
      // A filter's new list renders in the background, so a tab or chip changes the moment it's
      // tapped; the first one lands at once, with the placeholders going.
      if (listShown.current) startTransition(show);
      else show();
      listShown.current = true;
    } catch (err) {
      listShown.current = false;
      setError(err instanceof Error ? err.message : 'Failed to load exercises');
    } finally {
      setLoading(false);
    }
  }, [userId, search, source, sharedRows]);

  useEffect(() => {
    void load();
  }, [load]);

  // The category cards' own totals -- independent of search/filter, so this
  // only runs on mount and when what's shared changes, not on every filter change above.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchExerciseSourceCounts(userId, sharedRows)
      .then((counts) => {
        if (!cancelled) setSourceCounts(counts);
      })
      .catch(() => {
        if (!cancelled) setSourceCounts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, sharedRows]);

  function handleDone() {
    setMode({ type: 'list' });
    void load();
  }

  // Deleting one of their own exercises from the list does what the form's Delete does: it's
  // deactivated, leaving the library and the picker, and every past workout keeps its history.
  const deleteMine = useCallback(
    async (exercise: ExerciseRow) => {
      if (!accessToken) throw new Error('Please sign in again.');
      await updateExercise(accessToken, exercise.id, { isActive: false });
      invalidateExerciseCache(userId);
      setRows((prev) => prev.filter((row) => row.id !== exercise.id));
      setSourceCounts((prev) => prev && { ...prev, all: prev.all - 1, mine: prev.mine - 1 });
    },
    [accessToken, userId],
  );

  if (mode.type === 'create') {
    return (
      <ExerciseFormScreen
        mode="create"
        initialName={mode.name}
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
      rollout={false}
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
        equipment={equipment}
        onEquipmentChange={setEquipment}
        source={source}
        onSourceChange={setSource}
        sourceCounts={sourceCounts}
        rows={rows}
        loading={loading}
        updating={readFor.source !== source}
        // Friends is only what's shared, so a failure to read it is the tab's own.
        error={source === 'friends' ? (shared.error ?? error) : error}
        onRetry={source === 'friends' && shared.error ? shared.reload : load}
        accent={{ color: theme.accent, background: theme.accentBg, onColor: theme.onAccent }}
        onOpenMine={(exercise) => setMode({ type: 'edit', exercise })}
        onOpenExercise={(exercise) =>
          navigation.navigate('ProgressExerciseDetail', {
            exerciseId: exercise.id,
            exerciseName: exercise.name,
          })
        }
        onDeleteMine={deleteMine}
        friends={friends}
        browseByMuscle
        onCreate={(searched) => setMode({ type: 'create', name: searched })}
        testID="exercise-library"
      />
    </Screen>
  );
}
