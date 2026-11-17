import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Text } from '../design/Text';
import { spacing } from '../design/theme';
import { TextInput } from '../design/TextInput';
import { MuscleGroupChips } from '../exercises/MuscleGroupChips';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import { fromKg, roundWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import type { HistoricalSetWithExercise } from '../workouts/allExerciseHistoryQueries';
import { ProgressEmptyState } from './ProgressEmptyState';
import { progressStyles as styles } from './progressStyles';
import { computeTopSets, type TopSetRow as TopSet } from './topSets';
import { TopSetRow } from './TopSetRow';

type Navigation = RootStackScreenProps<'ProgressOverview'>['navigation'];

interface Props {
  history: HistoricalSetWithExercise[];
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  onAccentColor: string;
  navigation: Navigation;
  /** Opens a top set to fix it (EditTopSetSheet); without it, top sets can't be edited here. */
  onEdit?: (topSet: TopSet) => void;
  /**
   * Whether tapping a row opens the exercise's own Progress page -- the signed-in person's.
   * A trainer's view of a client turns it off: that page would show the trainer's own sets.
   */
  opensExercise?: boolean;
}

const ItemSeparator = () => <View style={styles.separator} />;

// One row per exercise -- its single best qualifying set (see topSets.ts),
// alphabetical by exercise name, searchable and filterable by the same
// muscle-group taxonomy the Exercise Library already uses (MuscleGroupChips,
// not a second/coarser grouping invented for this page). Exercises with no
// qualifying set never appear -- no fabricated rows.
export function TopSetsSection({
  history,
  weightUnit,
  accentColor,
  onAccentColor,
  navigation,
  onEdit,
  opensExercise = true,
}: Props) {
  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);

  const rows = useMemo(() => computeTopSets(history), [history]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (muscleGroup && r.muscleGroup !== muscleGroup) return false;
      if (query && !r.exerciseName.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [rows, search, muscleGroup]);

  if (rows.length === 0) {
    return (
      <View style={styles.sectionFill}>
        <Text style={styles.topSetsSectionTitle}>Top Sets</Text>
        <Text style={styles.topSetsSectionSubtitle}>
          Your best set for each exercise within the rep range.
        </Text>
        <ProgressEmptyState
          testID="progress-topsets-empty"
          title="Your best sets will appear here as you train."
          icon="trending-up"
        />
      </View>
    );
  }

  return (
    <View style={styles.sectionFill}>
      <Text style={styles.topSetsSectionTitle}>Top Sets</Text>
      <Text style={styles.topSetsSectionSubtitle}>
        Your best set for each exercise within the rep range.
      </Text>

      <View style={styles.searchWrap}>
        <TextInput
          testID="progress-topsets-search"
          placeholder="Search exercises..."
          accessibilityLabel="Search exercises"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <MuscleGroupChips
        value={muscleGroup}
        onChange={setMuscleGroup}
        includeAll
        accentColor={accentColor}
        onAccentColor={onAccentColor}
      />

      {filtered.length === 0 ? (
        <ProgressEmptyState testID="progress-topsets-no-results" title="No matching exercises" />
      ) : (
        <FlatList
          testID="progress-topsets-list"
          style={styles.sectionFill}
          data={filtered}
          keyExtractor={(item) => item.exerciseId}
          ItemSeparatorComponent={ItemSeparator}
          contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xxl }}
          renderItem={({ item }) => (
            <TopSetRow
              testID={`progress-topset-row-${item.exerciseId}`}
              exerciseName={item.exerciseName}
              muscleGroupLabel={MUSCLE_GROUP_LABELS[item.muscleGroup]}
              photoUrl={item.photoUrl}
              gym={item.gym}
              grip={item.grip}
              attachment={item.attachment}
              weightDisplay={roundWeight(fromKg(item.weightKg, weightUnit))}
              reps={item.reps}
              unit={weightUnit}
              accentColor={accentColor}
              onPress={
                opensExercise
                  ? () =>
                      navigation.navigate('ProgressExerciseDetail', {
                        exerciseId: item.exerciseId,
                        exerciseName: item.exerciseName,
                      })
                  : undefined
              }
              onEdit={onEdit ? () => onEdit(item) : undefined}
            />
          )}
        />
      )}
    </View>
  );
}
