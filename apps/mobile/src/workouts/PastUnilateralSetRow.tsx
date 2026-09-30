import { TextInput, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { colors } from '../design/theme';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';

export interface PastUnilateralSideInput {
  weight: string;
  reps: string;
}

interface Props {
  setIndex: number;
  left: PastUnilateralSideInput;
  right: PastUnilateralSideInput;
  onChangeWeight: (side: 'left' | 'right', text: string) => void;
  onChangeReps: (side: 'left' | 'right', text: string) => void;
  /** Removes both sides together -- one logical set, same as the live flow's completion handling. */
  onRemove: () => void;
  testID?: string;
}

const SIDES = [
  { key: 'left', tag: 'L', name: 'left' },
  { key: 'right', tag: 'R', name: 'right' },
] as const;

/** UnilateralSetRow's shape for LogPastWorkoutScreen -- see PastSetRow's own comment on why there's a remove button instead of a complete toggle here. */
export function PastUnilateralSetRow({
  setIndex,
  left,
  right,
  onChangeWeight,
  onChangeReps,
  onRemove,
  testID,
}: Props) {
  const values = { left, right };

  return (
    <View testID={testID} style={styles.unilateralSetRow}>
      <Text style={styles.setIndex}>{setIndex}</Text>

      <View style={styles.unilateralSideRows}>
        {SIDES.map(({ key, tag, name }) => (
          <View key={key} style={styles.unilateralSideRow}>
            <Text style={styles.unilateralSideLabel}>{tag}</Text>
            <TextInput
              testID={testID ? `${testID}-${key}-weight` : undefined}
              style={styles.setInput}
              accessibilityLabel={`Set ${setIndex} ${name} weight`}
              keyboardType="decimal-pad"
              value={values[key].weight}
              onChangeText={(text) => onChangeWeight(key, text)}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              testID={testID ? `${testID}-${key}-reps` : undefined}
              style={styles.setInput}
              accessibilityLabel={`Set ${setIndex} ${name} reps`}
              keyboardType="number-pad"
              value={values[key].reps}
              onChangeText={(text) => onChangeReps(key, text)}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        ))}
      </View>

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
