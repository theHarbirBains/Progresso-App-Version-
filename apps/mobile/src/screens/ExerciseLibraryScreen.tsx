import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, SectionList, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AlphabetIndexRail } from '../design/AlphabetIndexRail';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { TextInput } from '../design/TextInput';
import { colors } from '../design/theme';
import {
  fetchAllExercises,
  fetchExerciseSourceCounts,
  type ExerciseRow,
  type ExerciseSource,
  type ExerciseSourceCounts,
} from '../exercises/exerciseQueries';
import {
  ALPHABET_INDEX_LETTERS,
  groupExercisesByLetter,
} from '../exercises/exerciseLibraryGrouping';
import { ExercisePhoto } from '../exercises/ExercisePhoto';
import { MuscleGroupChips } from '../exercises/MuscleGroupChips';
import { MOVEMENT_TYPE_LABELS } from '../exercises/movementTypes';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { ExerciseFormScreen } from './ExerciseFormScreen';
import { exerciseLibraryStyles as styles } from './exerciseLibraryStyles';

const SEARCH_DEBOUNCE_MS = 300;

type Props = RootStackScreenProps<'ExerciseLibrary'>;

type Mode = { type: 'list' } | { type: 'create' } | { type: 'edit'; exercise: ExerciseRow };

const SOURCE_OPTIONS: { value: ExerciseSource; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'builtin', label: 'Built-in' },
  { value: 'mine', label: 'Mine' },
];

// The Workout Mode "browse every exercise" screen -- built-ins plus the
// user's own custom exercises, searchable/filterable/sortable, sectioned
// alphabetically (A-Z, like iOS Contacts) with a jump-to-letter index on the
// right, the same treatment FoodLibraryScreen already uses -- a jump index
// needs the whole (filtered) result set up front, so this loads everything
// matching the current filters rather than paging (see fetchAllExercises).
//
// Layout: two widgets `widgetGap` apart. The browse widget holds search, the
// muscle filter and an All / Built-in / Mine block row with the real
// per-source totals; the list widget holds the count and sort control, then
// the exercises as rows under letter headings -- each with its machine photo
// (or a plain initial, "like a contact photo" -- see ExercisePhoto), name,
// "Muscle · Movement", and a quiet Built-in/Mine marker, with the A-Z rail on
// the right. New Exercise is the header's "+". Your own exercises open for
// editing; built-ins are read-only.
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLetter, setActiveLetter] = useState<string | undefined>(undefined);
  const sectionListRef = useRef<SectionList<ExerciseRow>>(null);
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
      const result = await fetchAllExercises({ userId, search, muscleGroup, source, ascending });
      setRows(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exercises');
    } finally {
      setLoading(false);
    }
  }, [userId, search, muscleGroup, source, ascending]);

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

  const sections = groupExercisesByLetter(rows);
  const availableLetters = new Set(sections.map((section) => section.letter));

  function jumpToLetter(letter: string) {
    const sectionIndex = sections.findIndex((section) => section.letter === letter);
    if (sectionIndex === -1) return;
    setActiveLetter(letter);
    sectionListRef.current?.scrollToLocation({
      sectionIndex,
      itemIndex: 0,
      viewPosition: 0,
      animated: true,
    });
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

      <AppCard testID="exercise-library-list" style={styles.listCard}>
        <View style={styles.countSortRow}>
          <Text testID="exercise-library-count" style={styles.countText}>
            {rows.length} {rows.length === 1 ? 'exercise' : 'exercises'}
          </Text>
          <TextButton
            testID="exercise-library-sort"
            label={`Sort: ${ascending ? 'A → Z' : 'Z → A'}`}
            accessibilityLabel="Toggle sort order"
            onPress={() => setAscending((prev) => !prev)}
          />
        </View>

        {error ? (
          <ErrorState testID="exercise-library-error" message={error} onRetry={load} />
        ) : loading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              testID="exercise-library-loading"
              size="large"
              color={colors.textPrimary}
            />
          </View>
        ) : rows.length === 0 ? (
          <EmptyState testID="exercise-library-empty" title="No exercises found" />
        ) : (
          <View style={styles.flex}>
            <SectionList
              ref={sectionListRef}
              testID="exercise-library-list-section"
              sections={sections.map((section) => ({
                title: section.letter,
                data: section.data,
              }))}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderSectionHeader={({ section }) => (
                <View testID={`exercise-library-section-${section.title}`}>
                  <SectionHeader label={section.title} />
                </View>
              )}
              renderItem={({ item, index }) => {
                const isMine = item.createdBy != null;
                return (
                  <View style={[styles.row, index > 0 && styles.rowDivider]}>
                    <ListRow
                      testID={`exercise-item-${item.id}`}
                      leading={
                        <ExercisePhoto
                          testID={`exercise-item-${item.id}-photo`}
                          uri={item.photoUrl}
                          name={item.name}
                        />
                      }
                      title={item.name}
                      subtitle={`${MUSCLE_GROUP_LABELS[item.muscleGroup]} · ${MOVEMENT_TYPE_LABELS[item.movementType]}`}
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
                  </View>
                );
              }}
              onScrollToIndexFailed={() => {
                // A section can be shorter than the viewport at the very end
                // of the list; retry is unnecessary since scrollToLocation
                // already handles this internally on modern RN -- this is
                // just a safety net against the dev-only warning.
              }}
            />
            <View style={styles.indexRailWrap} pointerEvents="box-none">
              <AlphabetIndexRail
                testID="exercise-library-index"
                letters={ALPHABET_INDEX_LETTERS}
                availableLetters={availableLetters}
                activeLetter={activeLetter}
                onSelect={jumpToLetter}
                accentColor={theme.accent}
              />
            </View>
          </View>
        )}
      </AppCard>
    </Screen>
  );
}
