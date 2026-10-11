import { memo } from 'react';
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
function PastUnilateralSetRowComponent({
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

function sideEqual(a: PastUnilateralSideInput, b: PastUnilateralSideInput): boolean {
  return a.weight === b.weight && a.reps === b.reps;
}

// Same reasoning as PastSetRow's own comparator: the caller rebuilds left/right as fresh
// objects every render (groupUnilateralSets runs inline, not memoized) and never stabilizes
// its callbacks, so only the data props are compared -- that's what actually lets typing
// into one set skip re-rendering every other one. Exported for the same reason
// ExerciseCard/PastSetRow export theirs: direct, deterministic unit testing.
export function arePropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.setIndex === next.setIndex &&
    prev.testID === next.testID &&
    sideEqual(prev.left, next.left) &&
    sideEqual(prev.right, next.right)
  );
}

export const PastUnilateralSetRow = memo(PastUnilateralSetRowComponent, arePropsEqual);
