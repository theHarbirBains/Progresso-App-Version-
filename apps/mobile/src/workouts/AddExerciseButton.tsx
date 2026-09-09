import { Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../design/theme';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';

interface Props {
  onPress: () => void;
  testID?: string;
}

export function AddExerciseButton({ onPress, testID }: Props) {
  return (
    <TouchableOpacity testID={testID} style={styles.addExerciseButton} onPress={onPress}>
      <Feather name="plus" size={16} color={colors.textPrimary} />
      <Text style={styles.addExerciseButtonText}>Add Exercise</Text>
    </TouchableOpacity>
  );
}
