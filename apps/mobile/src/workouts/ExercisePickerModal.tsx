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
import { colors } from '../design/theme';
import { fetchExercises, type ExerciseRow } from '../exercises/exerciseQueries';
import { MuscleGroupChips } from '../exercises/MuscleGroupChips';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
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
}

/**
 * The existing search/select flow (fetchExercises, MuscleGroupChips),
 * reused as a modal so it works both before a workout exists (NewWorkoutScreen)
 * and mid-workout (ActiveWorkoutScreen) without duplicating the search UI.
 */
export function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
  userId,
  alreadyAddedIds,
}: Props) {
  const insets = useSafeAreaInsets();
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
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

          <MuscleGroupChips value={muscleGroup} onChange={setMuscleGroup} includeAll />

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
