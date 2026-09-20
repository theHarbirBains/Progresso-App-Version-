import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, View } from 'react-native';
import { Text } from '../design/Text';
import { AppHeader } from '../design/AppHeader';
import { useBackgroundTheme } from '../design/BackgroundThemeContext';
import { ListRow } from '../design/ListRow';
import { TextInput } from '../design/TextInput';
import { colors } from '../design/theme';
import { fetchExercises, type ExerciseRow } from '../exercises/exerciseQueries';
import { MuscleGroupChips } from '../exercises/MuscleGroupChips';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

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
 * The existing search/select flow (fetchExercises, MuscleGroupChips),
 * reused as a modal so it works mid-workout (ActiveWorkoutScreen) without
 * duplicating the search UI. A search field and muscle filter over one list
 * of plain rows; "Create Custom Exercise" is the first row, not a card.
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
  const [rows, setRows] = useState<ExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;
    setLoading(true);
    fetchExercises({ userId, search, muscleGroup, source: 'all', page: 0, pageSize: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) setRows(result.rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, userId, search, muscleGroup]);

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      {/* Unlike a normal stacked screen, a native Modal opens its own
          separate window -- it does NOT sit behind AppBackgroundLayer, so
          `styles.screen`'s usual transparent background would expose the
          OS's own (light) window background instead. This is the one place
          that needs the current Background Theme's color applied directly. */}
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
          <TextInput
            testID="exercise-picker-search"
            placeholder="Search exercises"
            accessibilityLabel="Search exercises"
            value={searchInput}
            onChangeText={setSearchInput}
          />

          <View testID="exercise-picker-muscle-group-wrap" style={styles.muscleGroupChipsWrap}>
            <MuscleGroupChips
              value={muscleGroup}
              onChange={setMuscleGroup}
              includeAll
              accentColor={accentColor}
              onAccentColor={onAccentColor}
              chipBorderColor={colors.border}
              chipTextColor={colors.textSecondary}
            />
          </View>

          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <>
                <ListRow
                  testID="exercise-picker-create-custom"
                  icon="plus"
                  title="Create Custom Exercise"
                  subtitle="Can't find the exercise? Create your own."
                  onPress={onCreateCustom}
                  accessibilityLabel="Create Custom Exercise. Can't find the exercise? Create your own."
                />
                {loading ? (
                  <View style={styles.pickerLoading}>
                    <ActivityIndicator
                      testID="exercise-picker-loading"
                      size="large"
                      color={colors.textPrimary}
                    />
                  </View>
                ) : null}
              </>
            }
            renderItem={({ item }) => {
              const added = alreadyAddedIds.includes(item.id);
              return (
                <ListRow
                  testID={`exercise-picker-item-${item.id}`}
                  title={`${item.name}${added ? ' (added)' : ''}`}
                  subtitle={MUSCLE_GROUP_LABELS[item.muscleGroup]}
                  chevron={false}
                  divider
                  disabled={added}
                  onPress={() => onSelect(item)}
                  accessibilityLabel={`${item.name}, ${MUSCLE_GROUP_LABELS[item.muscleGroup]}${added ? ', already added' : ''}`}
                />
              );
            }}
            ListEmptyComponent={
              !loading ? <Text style={styles.pickerEmptyText}>No exercises found</Text> : null
            }
          />
        </View>
      </View>
    </Modal>
  );
}
