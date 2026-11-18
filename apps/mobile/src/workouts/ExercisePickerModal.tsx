import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { updateExercise } from '../lib/api';
import { Alert, Modal, View } from 'react-native';
import { AppHeader } from '../design/AppHeader';
import { ListRow } from '../design/ListRow';
import { PhotoLightbox } from '../design/PhotoLightbox';
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
import { SectionHeader } from '../design/SectionHeader';
import { ExercisePhoto } from '../exercises/ExercisePhoto';
import { machineLine } from '../exercises/machineDetails';
import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import type { HistoricalSetWithExercise } from './exerciseHistoryGrouping';

/** How many recent exercises show, and how far back through them it looks to find that many. */
const RECENT_COUNT = 6;
const RECENT_LOOKBACK = 12;

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
  /** Their own logged sets (the shared history): given, the exercises they logged most recently
   * are listed first, as Recent -- a live workout's picker. */
  recentHistory?: HistoricalSetWithExercise[];
  /** Defaults to the static brand accent -- pass the user's Workout accent. */
  accentColor?: string;
  onAccentColor?: string;
}

/**
 * Add Exercise during a workout. It is the Exercise Library's own browse layout (the shared
 * ExerciseBrowser), so the two look the same: search, muscle filter, All / Built-in /
 * Custom with counts, and the exercises A-Z with their photos. Tapping an exercise adds
 * it; a tapped photo opens full size. Exercises already in the workout are greyed out.
 */
export function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
  userId,
  alreadyAddedIds,
  onCreateCustom,
  recentHistory,
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

  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;
    if (!listShown.current) setLoading(true);
    setError(null);
    fetchAllExercises({
      userId,
      search,
      // The muscle filter is applied in the list itself (ExerciseBrowser), from these rows.
      muscleGroup: null,
      source,
      shared: sharedRows,
      equipment,
    })
      .then((result) => {
        if (cancelled) return;
        setRows(result);
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
  }, [visible, userId, search, source, attempt, sharedRows, equipment]);

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

  // Recent: the exercises they logged last, newest first, from the history already read (no
  // fetch) -- before any search or filter, leaving out what's already in the workout.
  const recentIds = useMemo(() => {
    if (!recentHistory) return [];
    const ids: string[] = [];
    const seen = new Set<string>();
    const newestFirst = [...recentHistory].sort(
      (a, b) => Date.parse(b.performedAt) - Date.parse(a.performedAt),
    );
    for (const set of newestFirst) {
      if (seen.has(set.exerciseId)) continue;
      seen.add(set.exerciseId);
      ids.push(set.exerciseId);
      if (ids.length >= RECENT_LOOKBACK) break;
    }
    return ids;
  }, [recentHistory]);
  const recent = useMemo(() => {
    if (
      recentIds.length === 0 ||
      searchInput.trim() ||
      muscleGroup ||
      equipment ||
      source !== 'all'
    )
      return [];
    const byId = new Map([...rows, ...sharedRows].map((row) => [row.id, row]));
    return recentIds
      .map((id) => byId.get(id))
      .filter((row): row is ExerciseRow => row !== undefined && !alreadyAddedIdSet.has(row.id))
      .slice(0, RECENT_COUNT);
  }, [recentIds, searchInput, muscleGroup, equipment, source, rows, sharedRows, alreadyAddedIdSet]);

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

        <View style={styles.pickerBody}>
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
            listHeader={
              onCreateCustom || recent.length > 0 ? (
                <>
                  {onCreateCustom ? (
                    <ListRow
                      testID="exercise-picker-create-custom"
                      icon="plus"
                      title="Create Custom Exercise"
                      subtitle="Can't find the exercise? Create your own."
                      onPress={onCreateCustom}
                      accessibilityLabel="Create Custom Exercise. Can't find the exercise? Create your own."
                    />
                  ) : null}
                  {recent.length > 0 ? (
                    <View testID="exercise-picker-recent">
                      <SectionHeader label="Recent" />
                      {recent.map((exercise, index) => (
                        <ListRow
                          key={exercise.id}
                          testID={`exercise-picker-recent-${exercise.id}`}
                          divider={index > 0}
                          leading={
                            <ExercisePhoto
                              uri={exercise.photoUrl}
                              name={exercise.name}
                              size={40}
                              exerciseId={exercise.createdBy === null ? exercise.id : undefined}
                              slug={exercise.slug}
                            />
                          }
                          title={exercise.name}
                          subtitle={
                            machineLine(exercise, MUSCLE_GROUP_LABELS[exercise.muscleGroup]) ??
                            undefined
                          }
                          onPress={() => void choose(exercise)}
                        />
                      ))}
                    </View>
                  ) : null}
                </>
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
