import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { updateExercise } from '../lib/api';
import { Alert, Modal, ScrollView, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { TextButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { PhotoLightbox } from '../design/PhotoLightbox';
import { SegmentedControl } from '../design/SegmentedControl';
import { colors } from '../design/theme';
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
import type { MuscleGroup } from '../exercises/muscleGroups';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { PreviousExercisesSection } from './PreviousExercisesSection';
import type { PreviousExercisesState } from './usePreviousExercises';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Adding one exercise closes the modal -- reopen "+ Add Exercise" for another. */
  onSelect: (exercise: ExerciseRow) => void;
  userId: string;
  /** Already-added exercise ids, shown as "(added)" and disabled -- same
   * convention NewWorkoutScreen already used. */
  alreadyAddedIds: string[];
  /** Opens the Create Custom Exercise flow without leaving this picker. */
  /** Offers "Create Custom Exercise" at the top of the list; left out, it isn't offered. */
  onCreateCustom?: () => void;
  /**
   * A live workout's previous exercises (usePreviousExercises): given, the picker has two tabs --
   * Last Time (what they did the last time they trained each muscle group), where it opens, and
   * All Exercises (the whole library) -- with the muscle groups already in the workout, and the
   * unit to show weights in.
   */
  previous?: {
    state: PreviousExercisesState;
    addedGroups: MuscleGroup[];
    weightUnit: 'kg' | 'lb';
  };
  /** Defaults to the static brand accent -- pass the user's Workout accent. */
  accentColor?: string;
  onAccentColor?: string;
}

type PickerTab = 'previous' | 'all';

const TAB_OPTIONS: { label: string; value: PickerTab }[] = [
  { label: 'Last Time', value: 'previous' },
  { label: 'All Exercises', value: 'all' },
];

/**
 * Add Exercise during a workout. Its All Exercises is the Exercise Library's own browse layout
 * (the shared ExerciseBrowser), so the two look the same: search, muscle filter, All / Built-in /
 * Custom with counts, and the exercises A-Z with their photos. Tapping an exercise adds it; a
 * tapped photo opens full size. Exercises already in the workout are greyed out. In a live
 * workout it opens on a tab of its own, Last Time -- the person's previous exercises
 * (PreviousExercisesSection) -- unless they have none yet; the other tab is the whole library.
 */
export function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
  userId,
  alreadyAddedIds,
  onCreateCustom,
  previous,
  accentColor: accentColorProp,
  onAccentColor: onAccentColorProp,
}: Props) {
  // Unless told otherwise, the app theme's accent and the ink that reads on it.
  const themeAccent = useAppTheme().accent;
  const accentColor = accentColorProp ?? themeAccent.accent;
  const onAccentColor = onAccentColorProp ?? themeAccent.onAccent;
  const reduceMotion = useReduceMotionPreference();
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
  const [error, setError] = useState<string | null>(null);
  const [sourceCounts, setSourceCounts] = useState<ExerciseSourceCounts | null>(null);
  const accessToken = useAuth().session?.access_token;
  // A trainer's, a client's or a friend's exercise can be chosen too; it becomes theirs first.
  const shared = useSharedExercises(visible);
  const sharedRows = shared.rows;
  const friends = useMemo(() => sharingFriends(sharedRows), [sharedRows]);

  // Swiping one of your own exercises away deletes it from your library, here as in the library
  // itself: it leaves the list and the picker, and every workout it was logged in keeps it.
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
  const [photoOpen, setPhotoOpen] = useState<string | null>(null);
  // Bumped by Retry to load the exercises again.
  const [attempt, setAttempt] = useState(0);
  // Last Time or All Exercises. Each opening starts on Last Time (when there's one); with no
  // history at all it moves to All Exercises by itself, unless a tab has been tapped.
  const hasPrevious = previous !== undefined;
  const [tab, setTab] = useState<PickerTab>(hasPrevious ? 'previous' : 'all');
  const tabTapped = useRef(false);
  const noHistory = previous?.state.status === 'ready' && previous.state.groups.length === 0;
  useEffect(() => {
    if (!visible) return;
    tabTapped.current = false;
    setTab(hasPrevious && !noHistory ? 'previous' : 'all');
    // Only as it opens: a tab tapped meanwhile stays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, hasPrevious]);
  useEffect(() => {
    if (noHistory && !tabTapped.current) setTab('all');
  }, [noHistory]);
  const chooseTab = (next: PickerTab) => {
    tabTapped.current = true;
    setTab(next);
  };
  // The source the rows on screen were read for: while it differs from what's chosen, the list
  // fades softly (ExerciseBrowser's `updating`).
  const [readFor, setReadFor] = useState<{ source: ExerciseSource }>({ source: 'all' });

  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;
    if (!listShown.current) setLoading(true);
    setError(null);
    fetchAllExercises({
      userId,
      search,
      // The muscle, equipment and movement filters are applied in the list itself
      // (ExerciseBrowser), from these rows.
      muscleGroup: null,
      source,
      shared: sharedRows,
    })
      .then((result) => {
        if (cancelled) return;
        const show = () => {
          setRows(result);
          setReadFor({ source });
        };
        // A filter's new list renders in the background, so a tab or chip changes the moment it's
        // tapped; the first one lands at once, with the placeholders going.
        if (listShown.current) startTransition(show);
        else show();
        listShown.current = true;
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        listShown.current = false;
        setError(err instanceof Error ? err.message : 'Failed to load exercises');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, userId, search, source, attempt, sharedRows]);

  // The tab counts are independent of the search and filter, so they load once per opening.
  useEffect(() => {
    if (!visible || !userId) return;
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
  }, [visible, userId, sharedRows]);

  const alreadyAddedIdSet = useMemo(() => new Set(alreadyAddedIds), [alreadyAddedIds]);

  // The whole library, unfiltered, for Last Time -- its own exercises and the ones shared with
  // them, by id: a previous exercise is only ever offered as itself, whatever All Exercises is
  // searched or filtered to (read from the same in-memory cache).
  const [fullLibrary, setFullLibrary] = useState<ExerciseRow[] | null>(null);
  useEffect(() => {
    if (!visible || !userId || !hasPrevious) return;
    let cancelled = false;
    fetchAllExercises({ userId, search: '', muscleGroup: null, source: 'all', shared: sharedRows })
      .then((result) => {
        if (!cancelled) setFullLibrary(result);
      })
      .catch(() => {
        if (!cancelled) setFullLibrary([]);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, userId, hasPrevious, sharedRows, attempt]);
  const library = useMemo(
    () => new Map([...(fullLibrary ?? []), ...sharedRows].map((row) => [row.id, row])),
    [fullLibrary, sharedRows],
  );

  // A friend's exercise is used as it is -- its creator's changes reach everyone using it. A
  // trainer's or client's is made theirs first (a copy in their library, or their own of the very
  // same machine), as before.
  const [choosing, setChoosing] = useState(false);
  async function choose(exercise: ExerciseRow) {
    if (!exercise.shared || exercise.shared.source === 'friend') {
      if (alreadyAddedIdSet.has(exercise.id)) {
        Alert.alert(`${exercise.name} is already here`, "It's already in this workout.");
        return;
      }
      onSelect(exercise);
      return;
    }
    if (choosing) return;
    setChoosing(true);
    try {
      const own = await shared.makeOwn(exercise);
      if (alreadyAddedIdSet.has(own.id)) {
        Alert.alert(`${own.name} is already here`, 'Your own one is already in this workout.');
        return;
      }
      onSelect(own);
    } catch (err) {
      Alert.alert(
        `Couldn't add ${exercise.name}`,
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setChoosing(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      {/* A native Modal opens its own window, outside AppBackgroundLayer, so it takes the
          warm background colour itself. */}
      <View
        testID="exercise-picker-root"
        style={[styles.flex, { backgroundColor: colors.background }]}
      >
        <AppHeader
          title="Add Exercise"
          rightAction={{
            icon: 'x',
            onPress: onClose,
            accessibilityLabel: 'Close',
            testID: 'exercise-picker-close',
          }}
        />

        {previous ? (
          <View style={styles.pickerTabs}>
            <SegmentedControl
              testID="exercise-picker-tabs"
              options={TAB_OPTIONS}
              value={tab}
              onChange={chooseTab}
              accentColor={accentColor}
              onAccentColor={onAccentColor}
            />
          </View>
        ) : null}

        {/* Both tabs stay mounted, so switching is instant and each keeps its place. */}
        {previous ? (
          <View style={[styles.pickerBody, tab !== 'previous' && styles.hidden]}>
            <AppCard testID="exercise-picker-previous-card" style={styles.flex}>
              <ScrollView
                keyboardDismissMode="on-drag"
                testID="exercise-picker-previous-scroll"
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <PreviousExercisesSection
                  testID="exercise-picker-previous"
                  previous={
                    fullLibrary === null && previous.state.status === 'ready'
                      ? { ...previous.state, status: 'loading' }
                      : previous.state
                  }
                  addedGroups={previous.addedGroups}
                  library={library}
                  alreadyAddedIds={alreadyAddedIdSet}
                  weightUnit={previous.weightUnit}
                  onSelect={(exercise) => void choose(exercise)}
                />
                <TextButton
                  testID="exercise-picker-browse-all"
                  label="Browse All Exercises"
                  onPress={() => chooseTab('all')}
                />
              </ScrollView>
            </AppCard>
          </View>
        ) : null}

        <View style={[styles.pickerBody, tab !== 'all' && styles.hidden]}>
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
            error={source === 'friends' ? (shared.error ?? error) : error}
            onRetry={() => {
              if (source === 'friends' && shared.error) shared.reload();
              else setAttempt((n) => n + 1);
            }}
            accent={{
              color: accentColor,
              background: withAlpha(accentColor, 0.14),
              onColor: onAccentColor,
            }}
            isRowDisabled={(exercise) => alreadyAddedIdSet.has(exercise.id)}
            rowSuffix={(exercise) => (alreadyAddedIdSet.has(exercise.id) ? ' (added)' : '')}
            onSelectRow={(exercise) => void choose(exercise)}
            onPhotoPress={(exercise) => setPhotoOpen(exercise.photoUrl)}
            onDeleteMine={deleteMine}
            friends={friends}
            browseByMuscle
            onCreate={onCreateCustom ? () => onCreateCustom() : undefined}
            listHeader={
              onCreateCustom ? (
                <ListRow
                  testID="exercise-picker-create-custom"
                  icon="plus"
                  title="Create Custom Exercise"
                  subtitle="Can't find the exercise? Create your own."
                  onPress={onCreateCustom}
                  accessibilityLabel="Create Custom Exercise. Can't find the exercise? Create your own."
                />
              ) : undefined
            }
            testID="exercise-picker"
          />
        </View>
      </View>

      <PhotoLightbox
        testID="exercise-picker-lightbox"
        visible={photoOpen !== null}
        uri={photoOpen}
        onClose={() => setPhotoOpen(null)}
      />
    </Modal>
  );
}
