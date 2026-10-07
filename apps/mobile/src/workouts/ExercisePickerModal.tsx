import { useEffect, useMemo, useState } from 'react';
import { Modal, View } from 'react-native';
import { AppHeader } from '../design/AppHeader';
import { useBackgroundTheme } from '../design/BackgroundThemeContext';
import { ListRow } from '../design/ListRow';
import { PhotoLightbox } from '../design/PhotoLightbox';
import { colors } from '../design/theme';
import {
  fetchAllExercises,
  fetchExerciseSourceCounts,
  type ExerciseRow,
  type ExerciseSource,
  type ExerciseSourceCounts,
} from '../exercises/exerciseQueries';
import { ExerciseBrowser } from '../exercises/ExerciseBrowser';
import type { MuscleGroup } from '../exercises/muscleGroups';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';
import { withAlpha } from '../theme/accentColor';

const SEARCH_DEBOUNCE_MS = 300;

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
  onCreateCustom: () => void;
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
  accentColor = colors.accent,
  onAccentColor = colors.onAccent,
}: Props) {
  const { theme: backgroundTheme } = useBackgroundTheme();
  const reduceMotion = useReduceMotionPreference();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
  const [source, setSource] = useState<ExerciseSource>('all');
  const [rows, setRows] = useState<ExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceCounts, setSourceCounts] = useState<ExerciseSourceCounts | null>(null);
  const [photoOpen, setPhotoOpen] = useState<string | null>(null);
  // Bumped by Retry to load the exercises again.
  const [attempt, setAttempt] = useState(0);

  // Debounce free-text search, as the Exercise Library does.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAllExercises({ userId, search, muscleGroup, source })
      .then((result) => {
        if (!cancelled) setRows(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load exercises');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, userId, search, muscleGroup, source, attempt]);

  // The tab counts are independent of the search and filter, so they load once per opening.
  useEffect(() => {
    if (!visible || !userId) return;
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
  }, [visible, userId]);

  const alreadyAddedIdSet = useMemo(() => new Set(alreadyAddedIds), [alreadyAddedIds]);

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      {/* A native Modal opens its own window, outside AppBackgroundLayer, so it takes the
          current Background Theme colour itself. */}
      <View
        testID="exercise-picker-root"
        style={[styles.flex, { backgroundColor: backgroundTheme.colors.background }]}
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
            source={source}
            onSourceChange={setSource}
            sourceCounts={sourceCounts}
            rows={rows}
            loading={loading}
            error={error}
            onRetry={() => setAttempt((n) => n + 1)}
            accent={{
              color: accentColor,
              background: withAlpha(accentColor, 0.14),
              onColor: onAccentColor,
            }}
            isRowDisabled={(exercise) => alreadyAddedIdSet.has(exercise.id)}
            rowSuffix={(exercise) => (alreadyAddedIdSet.has(exercise.id) ? ' (added)' : '')}
            onSelectRow={onSelect}
            onPhotoPress={(exercise) => setPhotoOpen(exercise.photoUrl)}
            listHeader={
              <ListRow
                testID="exercise-picker-create-custom"
                icon="plus"
                title="Create Custom Exercise"
                subtitle="Can't find the exercise? Create your own."
                onPress={onCreateCustom}
                accessibilityLabel="Create Custom Exercise. Can't find the exercise? Create your own."
              />
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
