import { TextInput, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { colors } from '../design/theme';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';

interface Props {
  setIndex: number;
  weight: string;
  reps: string;
  onChangeWeight: (text: string) => void;
  onChangeReps: (text: string) => void;
  onRemove: () => void;
  testID?: string;
}

/**
 * SetRow's shape for LogPastWorkoutScreen, where there is no live/in-
 * progress state at all -- every row typed in already represents something
 * that happened, so there's no "mark complete" concept to gate on. In its
 * place: a plain remove button, since a manually-entered set list is edited
 * freely (add one too many, take it back) rather than stepped through one
 * at a time.
 */
export function PastSetRow({
  setIndex,
  weight,
  reps,
  onChangeWeight,
  onChangeReps,
  onRemove,
  testID,
}: Props) {
  return (
    <View testID={testID} style={styles.setRow}>
      <Text style={styles.setIndex}>{setIndex}</Text>
      <TextInput
        testID={testID ? `${testID}-weight` : undefined}
        style={styles.setInput}
        accessibilityLabel={`Set ${setIndex} weight`}
        keyboardType="decimal-pad"
        value={weight}
        onChangeText={onChangeWeight}
        placeholder="0"
        placeholderTextColor={colors.textMuted}
      />
      <TextInput
        testID={testID ? `${testID}-reps` : undefined}
        style={styles.setInput}
        accessibilityLabel={`Set ${setIndex} reps`}
        keyboardType="number-pad"
        value={reps}
        onChangeText={onChangeReps}
        placeholder="0"
        placeholderTextColor={colors.textMuted}
      />
      <TouchableOpacity
        testID={testID ? `${testID}-remove` : undefined}
        style={styles.setCompleteButton}
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove set ${setIndex}`}
      >
        <Feather name="trash-2" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}
