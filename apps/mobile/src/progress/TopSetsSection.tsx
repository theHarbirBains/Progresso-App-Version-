import { useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { Text } from '../design/Text';
import { colors, spacing } from '../design/theme';
import { MuscleGroupChips } from '../exercises/MuscleGroupChips';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import { fromKg, roundWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import type { HistoricalSetWithExercise } from '../workouts/allExerciseHistoryQueries';
import { ProgressEmptyState } from './ProgressEmptyState';
import { progressStyles as styles } from './progressStyles';
import { computeTopSets } from './topSets';
import { TopSetRow } from './TopSetRow';

type Navigation = RootStackScreenProps<'ProgressOverview'>['navigation'];

interface Props {
  history: HistoricalSetWithExercise[];
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  onAccentColor: string;
  navigation: Navigation;
}

const ItemSeparator = () => <View style={{ height: spacing.sm }} />;

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

      <TextInput
        testID="progress-topsets-search"
        style={styles.searchInput}
        placeholder="Search exercises..."
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />

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
              weightDisplay={roundWeight(fromKg(item.weightKg, weightUnit))}
              reps={item.reps}
              unit={weightUnit}
              accentColor={accentColor}
              onPress={() =>
                navigation.navigate('ProgressExerciseDetail', {
                  exerciseId: item.exerciseId,
                  exerciseName: item.exerciseName,
                })
              }
            />
          )}
        />
      )}
    </View>
  );
}
