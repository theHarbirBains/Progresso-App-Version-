import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { SectionHeader } from '../design/SectionHeader';
import { colors } from '../design/theme';
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
    <View style={styles.section}>
      <SectionHeader label="Workouts" />
      <Text style={styles.cardSubtitle}>Manage workouts and workout splits.</Text>
      <AppCard>
        <TouchableOpacity
          testID="open-workouts"
          style={styles.row}
          onPress={onNavigateWorkoutHistory}
        >
          <View style={styles.rowIconWrap}>
            <Feather name="activity" size={16} color={colors.textSecondary} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Workout History</Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="open-workout-splits"
          style={[styles.row, styles.rowDivider]}
          onPress={onNavigateWorkoutSplits}
        >
          <View style={styles.rowIconWrap}>
            <Feather name="layers" size={16} color={colors.textSecondary} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Workout Splits</Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </AppCard>

      <View style={styles.section}>
        <SectionHeader label="Exercise Library" />
        <Text style={styles.cardSubtitle}>View and manage exercises.</Text>
        <AppCard>
          <TouchableOpacity
            testID="open-exercise-library"
            style={styles.row}
            onPress={onNavigateExerciseLibrary}
          >
            <View style={styles.rowIconWrap}>
              <Feather name="list" size={16} color={colors.textSecondary} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Exercise Library</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </AppCard>
      </View>

      <View style={styles.section}>
        <SectionHeader label="Nutrition" />
        <AppCard>
          <TouchableOpacity
            testID="open-nutrition"
            style={styles.row}
            onPress={onNavigateNutrition}
          >
            <View style={styles.rowIconWrap}>
              <Feather name="pie-chart" size={16} color={colors.textSecondary} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Nutrition</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </AppCard>
      </View>
    </View>
  );
}
