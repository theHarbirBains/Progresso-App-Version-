import { View } from 'react-native';
import { ListRow } from '../design/ListRow';
import { Section } from '../design/Section';
import { settingsStyles as styles } from './settingsStyles';

interface Props {
  onNavigateWorkoutSplits: () => void;
  onNavigateWorkoutHistory: () => void;
  onNavigateExerciseLibrary: () => void;
  onNavigateNutrition: () => void;
}

/** App category: links to existing screens only -- no duplicate workout/exercise/nutrition screens created here. */
export function AppCategory({
  onNavigateWorkoutSplits,
  onNavigateWorkoutHistory,
  onNavigateExerciseLibrary,
  onNavigateNutrition,
}: Props) {
  return (
    <View style={styles.categoryGap}>
      <Section title="Workouts">
        <ListRow
          testID="open-workouts"
          icon="activity"
          title="Workout History"
          onPress={onNavigateWorkoutHistory}
        />
        <ListRow
          testID="open-workout-splits"
          icon="layers"
          title="Workout Splits"
          divider
          onPress={onNavigateWorkoutSplits}
        />
      </Section>

      <Section title="Exercise Library">
        <ListRow
          testID="open-exercise-library"
          icon="list"
          title="Exercise Library"
          onPress={onNavigateExerciseLibrary}
        />
      </Section>

      <Section title="Nutrition">
        <ListRow
          testID="open-nutrition"
          icon="pie-chart"
          title="Nutrition"
          onPress={onNavigateNutrition}
        />
      </Section>
    </View>
  );
}
