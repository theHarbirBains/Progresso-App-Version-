import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppCard } from '../design/AppCard';
import { useBackgroundTheme } from '../design/BackgroundThemeContext';
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
 * duplicating the search UI.
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
  const insets = useSafeAreaInsets();
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
        style={[
          styles.screen,
          { backgroundColor: backgroundTheme.colors.background, paddingTop: insets.top },
        ]}
      >
        <View style={[styles.scrollContent, { flex: 1 }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Add Exercise</Text>
            <TouchableOpacity
              testID="exercise-picker-close"
              style={styles.headerIconButton}
              onPress={onClose}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Feather name="x" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <TextInput
            testID="exercise-picker-search"
            style={styles.searchInput}
            placeholder="Search exercises"
            placeholderTextColor={colors.textMuted}
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

          <AppCard
            testID="exercise-picker-create-custom"
            onPress={onCreateCustom}
            style={[styles.createCustomCard, { borderColor: accentColor }]}
            accessibilityLabel="Create Custom Exercise. Can't find the exercise? Create your own."
          >
            <View style={styles.createCustomRow}>
              <View style={[styles.createCustomIconCircle, { backgroundColor: accentColor }]}>
                <Feather name="plus" size={18} color={onAccentColor} />
              </View>
              <View style={styles.createCustomTextBlock}>
                <Text style={styles.createCustomTitle}>Create Custom Exercise</Text>
                <Text style={styles.createCustomSubtitle}>
                  Can&apos;t find the exercise? Create your own.
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.textMuted} />
            </View>
          </AppCard>

          {loading ? (
            <ActivityIndicator
              testID="exercise-picker-loading"
              size="large"
              color={colors.textPrimary}
            />
          ) : null}

          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const added = alreadyAddedIds.includes(item.id);
              return (
                <TouchableOpacity
                  testID={`exercise-picker-item-${item.id}`}
                  style={styles.pickerItem}
                  disabled={added}
                  onPress={() => onSelect(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${MUSCLE_GROUP_LABELS[item.muscleGroup]}${added ? ', already added' : ''}`}
                  accessibilityState={{ disabled: added }}
                >
                  <Text style={styles.pickerItemTitle}>
                    {item.name}
                    {added ? ' (added)' : ''}
                  </Text>
                  <Text style={styles.pickerItemMeta}>{MUSCLE_GROUP_LABELS[item.muscleGroup]}</Text>
                </TouchableOpacity>
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
