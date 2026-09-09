import { useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { colors } from '../design/theme';
import { fromKg, roundWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import type { ExerciseHistoryGroup } from '../workouts/allExerciseHistoryQueries';
import { summarizeProgress, topSetProgressionDetailed } from '../workouts/exerciseProgress';
import { ExerciseProgressRow } from './ExerciseProgressRow';
import { ProgressEmptyState } from './ProgressEmptyState';
import { progressStyles as styles } from './progressStyles';

type Navigation = RootStackScreenProps<'ProgressOverview'>['navigation'];

interface Props {
  groups: ExerciseHistoryGroup[];
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  navigation: Navigation;
}

interface ExerciseRow {
  exerciseId: string;
  exerciseName: string;
  currentKg: number;
  deltaKg: number | null;
  percent: number | null;
}

// The exercise-progress library: every tracked exercise, searchable, with
// the change since its first recorded top set -- reusing the exact same
// derivations as Most Improved (topSetProgressionDetailed + summarizeProgress).
// Tapping an exercise opens the existing ProgressExerciseDetailScreen --
// no duplicate detail experience.
export function ExercisesSection({ groups, weightUnit, accentColor, navigation }: Props) {
  const [search, setSearch] = useState('');

  const rows = useMemo<ExerciseRow[]>(() => {
    return groups
      .map((g) => {
        const points = topSetProgressionDetailed(g.sets);
        const s = summarizeProgress(points);
        const latest = points[points.length - 1];
        return {
          exerciseId: g.exerciseId,
          exerciseName: g.exerciseName,
          currentKg: latest.weightKg,
          deltaKg: s?.deltaKg ?? null,
          percent: s?.percent ?? null,
        };
      })
      .sort((a, b) => (b.percent ?? -Infinity) - (a.percent ?? -Infinity));
  }, [groups]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? rows.filter((r) => r.exerciseName.toLowerCase().includes(query)) : rows;
  }, [rows, search]);

  if (rows.length === 0) {
    return (
      <View style={styles.sectionFill}>
        <ProgressEmptyState
          testID="progress-exercises-empty"
          title="Complete a workout to start tracking your strength."
          icon="list"
        />
      </View>
    );
  }

  return (
    <View style={styles.sectionFill}>
      <TextInput
        testID="progress-exercises-search"
        style={styles.searchInput}
        placeholder="Search exercises"
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />

      {filtered.length === 0 ? (
        <ProgressEmptyState testID="progress-exercises-no-results" title="No matching exercises" />
      ) : (
        <FlatList
          testID="progress-exercises-list"
          style={styles.sectionFill}
          data={filtered}
          keyExtractor={(item) => item.exerciseId}
          renderItem={({ item, index }) => (
            <ExerciseProgressRow
              testID={`progress-exercise-row-${item.exerciseId}`}
              exerciseName={item.exerciseName}
              currentWeightDisplay={roundWeight(fromKg(item.currentKg, weightUnit))}
              unit={weightUnit}
              deltaDisplay={
                item.deltaKg !== null ? roundWeight(fromKg(item.deltaKg, weightUnit)) : null
              }
              percent={item.percent}
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
