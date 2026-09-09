import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../design/theme';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';

interface Props {
  title: string;
  onBack: () => void;
  /** Omitted entirely (no button rendered) when there's genuinely nothing
   * to expose yet -- e.g. before a workout has started. */
  onOpenOptions?: () => void;
  testID?: string;
}

export function WorkoutHeader({ title, onBack, onOpenOptions, testID }: Props) {
  return (
    <View testID={testID} style={styles.header}>
      <TouchableOpacity
        testID="workout-header-back"
        style={styles.headerIconButton}
        onPress={onBack}
        accessibilityLabel="Back"
        accessibilityRole="button"
      >
        <Feather name="chevron-left" size={20} color={colors.textPrimary} />
      </TouchableOpacity>

      <Text style={styles.headerTitle}>{title}</Text>

      {onOpenOptions ? (
        <TouchableOpacity
          testID="workout-header-options"
          style={styles.headerIconButton}
          onPress={onOpenOptions}
          accessibilityLabel="Workout options"
          accessibilityRole="button"
        >
          <Feather name="more-horizontal" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerIconButton} />
      )}
    </View>
  );
}
