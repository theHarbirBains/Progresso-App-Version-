import { useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { fromKg, roundWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import type { OneRepMaxWithExercise } from '../workouts/prSummaryQueries';
import { PRRow } from './PRRow';
import { ProgressEmptyState } from './ProgressEmptyState';
import { progressStyles as styles } from './progressStyles';

type Navigation = RootStackScreenProps<'ProgressOverview'>['navigation'];

interface Props {
  oneRepMaxes: OneRepMaxWithExercise[];
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  navigation: Navigation;
}

// True 1RMs only -- every row here comes from an actual logged set of
// exactly 1 rep (one_rep_maxes, database-maintained). No estimated 1RM is
// shown anywhere here, since no estimation formula exists in Progresso and
// the domain rule is explicit: true 1RM is never estimated from higher-rep
// sets.
export function OneRepMaxSection({ oneRepMaxes, weightUnit, accentColor, navigation }: Props) {
  const sorted = useMemo(
    () => [...oneRepMaxes].sort((a, b) => b.weightKg - a.weightKg),
    [oneRepMaxes],
  );

  if (sorted.length === 0) {
    return (
      <View style={styles.sectionFill}>
        <ProgressEmptyState
          testID="progress-1rm-empty"
          title="Log a single-rep set to record your first 1 Rep Max."
          icon="award"
        />
      </View>
    );
  }

  return (
    <FlatList
      testID="progress-1rm-list"
      style={styles.sectionFill}
      data={sorted}
      keyExtractor={(item) => item.exerciseId}
      renderItem={({ item, index }) => (
        <PRRow
          testID={`progress-1rm-row-${item.exerciseId}`}
          exerciseName={item.exerciseName}
          weightDisplay={roundWeight(fromKg(item.weightKg, weightUnit))}
          reps={null}
          unit={weightUnit}
          achievedAt={item.achievedAt}
          recordType="True 1RM"
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
  );
}
