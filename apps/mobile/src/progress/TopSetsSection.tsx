import { useMemo, useState } from 'react';
import { FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../design/theme';
import { fromKg, roundWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import type { ExerciseHistoryGroup } from '../workouts/allExerciseHistoryQueries';
import { topSetProgressionDetailed } from '../workouts/exerciseProgress';
import { ProgressEmptyState } from './ProgressEmptyState';
import { progressStyles as styles } from './progressStyles';
import { TopSetRow } from './TopSetRow';

type Navigation = RootStackScreenProps<'ProgressOverview'>['navigation'];
type SortKey = 'recent' | 'weight' | 'reps' | 'volume';

interface Props {
  groups: ExerciseHistoryGroup[];
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  onAccentColor: string;
  navigation: Navigation;
}

interface Row {
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  performedAt: string;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Most Recent' },
  { key: 'weight', label: 'Weight' },
  { key: 'reps', label: 'Reps' },
  { key: 'volume', label: 'Volume' },
];

// Every recorded top set (one per workout occurrence of an exercise), across
// every exercise -- following the existing "top set" definition exactly
// (topSetProgressionDetailed, applied per exercise then flattened), never
// redefined here. This is the only place Top Sets lives -- intentionally
// not on Home.
export function TopSetsSection({
  groups,
  weightUnit,
  accentColor,
  onAccentColor,
  navigation,
}: Props) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');

  const rows = useMemo<Row[]>(() => {
    return groups.flatMap((g) =>
      topSetProgressionDetailed(g.sets).map((p) => ({
        exerciseId: g.exerciseId,
        exerciseName: g.exerciseName,
        weightKg: p.weightKg,
        reps: p.reps,
        performedAt: p.performedAt,
      })),
    );
  }, [groups]);

  const filteredSorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? rows.filter((r) => r.exerciseName.toLowerCase().includes(query))
      : rows;
    const sorted = [...filtered];
    switch (sort) {
      case 'weight':
        sorted.sort((a, b) => b.weightKg - a.weightKg);
        break;
      case 'reps':
        sorted.sort((a, b) => b.reps - a.reps);
        break;
      case 'volume':
        sorted.sort((a, b) => b.weightKg * b.reps - a.weightKg * a.reps);
        break;
      case 'recent':
      default:
        sorted.sort(
          (a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime(),
        );
    }
    return sorted;
  }, [rows, search, sort]);

  if (rows.length === 0) {
    return (
      <View style={styles.sectionFill}>
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
      <TextInput
        testID="progress-topsets-search"
        style={styles.searchInput}
        placeholder="Search exercises"
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.sortRow}>
        {SORTS.map((s) => {
          const selected = sort === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              testID={`progress-topsets-sort-${s.key}`}
              style={[
                styles.chip,
                selected && { backgroundColor: accentColor, borderColor: accentColor },
              ]}
              onPress={() => setSort(s.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && { color: onAccentColor }]}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {filteredSorted.length === 0 ? (
        <ProgressEmptyState testID="progress-topsets-no-results" title="No matching exercises" />
      ) : (
        <FlatList
          testID="progress-topsets-list"
          style={styles.sectionFill}
          data={filteredSorted}
          keyExtractor={(item, index) => `${item.exerciseId}-${item.performedAt}-${index}`}
          renderItem={({ item, index }) => (
            <TopSetRow
              testID={`progress-topset-row-${index}`}
              exerciseName={item.exerciseName}
              weightDisplay={roundWeight(fromKg(item.weightKg, weightUnit))}
              reps={item.reps}
              unit={weightUnit}
              performedAt={item.performedAt}
              accentColor={accentColor}
              showDivider={index > 0}
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
