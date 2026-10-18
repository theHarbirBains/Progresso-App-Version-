import { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { colors } from '../design/theme';
import type { MeasurementType } from '../exercises/movementTypes';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';
import { SetValueFields } from './SetValueFields';

export interface PastUnilateralSideInput {
  weight: string;
  reps: string;
  /** A timed set's duration as typed. */
  duration?: string;
}

interface Props {
  setIndex: number;
  left: PastUnilateralSideInput;
  right: PastUnilateralSideInput;
  onChangeWeight: (side: 'left' | 'right', text: string) => void;
  onChangeReps: (side: 'left' | 'right', text: string) => void;
  onChangeDuration?: (side: 'left' | 'right', text: string) => void;
  /** What the exercise measures -- decides which fields show. Defaults to weight and reps. */
  measurementType?: MeasurementType;
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
  onChangeDuration,
  measurementType = 'weight_reps',
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
            <SetValueFields
              setId=""
              label={`Set ${setIndex} ${name}`}
              measurementType={measurementType}
              weight={values[key].weight}
              reps={values[key].reps}
              duration={values[key].duration ?? ''}
              completed={false}
              onChangeWeight={(_, text) => onChangeWeight(key, text)}
              onChangeReps={(_, text) => onChangeReps(key, text)}
              onChangeDuration={(_, text) => onChangeDuration?.(key, text)}
              testID={testID ? `${testID}-${key}` : undefined}
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
  return a.weight === b.weight && a.reps === b.reps && a.duration === b.duration;
}

// Same reasoning as PastSetRow's own comparator: the caller rebuilds left/right as fresh
// objects every render (groupUnilateralSets runs inline, not memoized) and never stabilizes
// its callbacks, so only the data props are compared -- that's what actually lets typing
// into one set skip re-rendering every other one. Exported for the same reason
// ExerciseCard/PastSetRow export theirs: direct, deterministic unit testing.
export function arePropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.setIndex === next.setIndex &&
    prev.measurementType === next.measurementType &&
    prev.testID === next.testID &&
    sideEqual(prev.left, next.left) &&
    sideEqual(prev.right, next.right)
  );
}

export const PastUnilateralSetRow = memo(PastUnilateralSetRowComponent, arePropsEqual);
