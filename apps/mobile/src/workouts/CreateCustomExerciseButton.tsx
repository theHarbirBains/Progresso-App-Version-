import { Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../design/theme';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';

interface Props {
  onPress: () => void;
  testID?: string;
}

export function CreateCustomExerciseButton({ onPress, testID }: Props) {
  return (
    <TouchableOpacity testID={testID} style={styles.addExerciseButton} onPress={onPress}>
      <Feather name="edit-3" size={16} color={colors.textPrimary} />
      <Text style={styles.addExerciseButtonText}>Create Custom</Text>
    </TouchableOpacity>
  );
}
