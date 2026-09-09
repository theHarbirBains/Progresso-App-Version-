import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { Badge } from '../design/Badge';
import { colors } from '../design/theme';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';
import { SetRow } from './SetRow';

export interface ExerciseCardSet {
  id: string;
  setIndex: number;
  weight: string;
  reps: string;
  completed: boolean;
  canComplete: boolean;
}

interface Props {
  exerciseName: string;
  muscleGroup: MuscleGroup;
  sets: ExerciseCardSet[];
  onChangeWeight: (setId: string, text: string) => void;
  onChangeReps: (setId: string, text: string) => void;
  onToggleComplete: (setId: string) => void;
  onAddSet: () => void;
  onRemoveExercise: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  accentColor: string;
  onAccentColor: string;
  testID?: string;
}

// No exercise image anywhere -- a plain icon box stands in for it, per the
// approved design direction. Every exercise uses the same "activity" icon
// (already the app's established generic workout icon, e.g. the bottom nav
// Workouts tab) rather than inventing a whole per-muscle-group icon set.
export function ExerciseCard({
  exerciseName,
  muscleGroup,
  sets,
  onChangeWeight,
  onChangeReps,
  onToggleComplete,
  onAddSet,
  onRemoveExercise,
  onMoveUp,
  onMoveDown,
  accentColor,
  onAccentColor,
  testID,
}: Props) {
  return (
    <AppCard testID={testID} style={styles.exerciseCard}>
      <View style={styles.exerciseCardHeader}>
        <View style={styles.exerciseIconBox}>
          <Feather name="activity" size={18} color={accentColor} />
        </View>
        <View style={styles.exerciseTitleBlock}>
          <Text style={styles.exerciseName}>{exerciseName}</Text>
          <Badge
            label={MUSCLE_GROUP_LABELS[muscleGroup]}
            color={accentColor}
            testID={testID ? `${testID}-muscle-group` : undefined}
          />
        </View>
        <View style={styles.exerciseHeaderActions}>
          {onMoveUp ? (
            <TouchableOpacity
              testID={testID ? `${testID}-move-up` : undefined}
              style={styles.exerciseIconAction}
              onPress={onMoveUp}
              accessibilityLabel="Move exercise up"
              accessibilityRole="button"
            >
              <Feather name="chevron-up" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
          {onMoveDown ? (
            <TouchableOpacity
              testID={testID ? `${testID}-move-down` : undefined}
              style={styles.exerciseIconAction}
              onPress={onMoveDown}
              accessibilityLabel="Move exercise down"
              accessibilityRole="button"
            >
              <Feather name="chevron-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            testID={testID ? `${testID}-remove` : undefined}
            style={styles.exerciseIconAction}
            onPress={onRemoveExercise}
            accessibilityLabel="Remove exercise"
            accessibilityRole="button"
          >
            <Feather name="trash-2" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {sets.length > 0 ? (
        <View style={styles.setHeaderRow}>
          <Text style={styles.setHeaderIndex}>Set</Text>
          <Text style={styles.setHeaderInput}>Weight</Text>
          <Text style={styles.setHeaderInput}>Reps</Text>
          <View style={styles.setHeaderComplete} />
        </View>
      ) : null}

      {sets.map((set) => (
        <SetRow
          key={set.id}
          testID={testID ? `${testID}-set-${set.id}` : undefined}
          setIndex={set.setIndex}
          weight={set.weight}
          reps={set.reps}
          completed={set.completed}
          canComplete={set.canComplete}
          onChangeWeight={(text) => onChangeWeight(set.id, text)}
          onChangeReps={(text) => onChangeReps(set.id, text)}
          onToggleComplete={() => onToggleComplete(set.id)}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
        />
      ))}

      <TouchableOpacity
        testID={testID ? `${testID}-add-set` : undefined}
        style={styles.addSetButton}
        onPress={onAddSet}
      >
        <Feather name="plus" size={16} color={colors.textSecondary} />
        <Text style={styles.addSetButtonText}>Add Set</Text>
      </TouchableOpacity>
    </AppCard>
  );
}
