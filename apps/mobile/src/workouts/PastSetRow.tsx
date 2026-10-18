import { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { colors } from '../design/theme';
import type { MeasurementType } from '../exercises/movementTypes';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';
import { SetValueFields } from './SetValueFields';

interface Props {
  setIndex: number;
  weight: string;
  reps: string;
  /** A timed set's duration as typed. */
  duration?: string;
  /** What the exercise measures -- decides which fields show. Defaults to weight and reps. */
  measurementType?: MeasurementType;
  onChangeWeight: (text: string) => void;
  onChangeReps: (text: string) => void;
  onChangeDuration?: (text: string) => void;
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
function PastSetRowComponent({
  setIndex,
  weight,
  reps,
  duration = '',
  measurementType = 'weight_reps',
  onChangeWeight,
  onChangeReps,
  onChangeDuration,
  onRemove,
  testID,
}: Props) {
  return (
    <View testID={testID} style={styles.setRow}>
      <Text style={styles.setIndex}>{setIndex}</Text>
      <SetValueFields
        setId=""
        label={`Set ${setIndex}`}
        measurementType={measurementType}
        weight={weight}
        reps={reps}
        duration={duration}
        completed={false}
        onChangeWeight={(_, text) => onChangeWeight(text)}
        onChangeReps={(_, text) => onChangeReps(text)}
        onChangeDuration={(_, text) => onChangeDuration?.(text)}
        testID={testID}
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

// EditWorkoutScreen/LogPastWorkoutScreen rebuild their whole exercise list as a fresh array
// on every render (a flat state array, mapped over directly -- no per-exercise memoized
// component the way ActiveWorkoutScreen's ExerciseCard is), and their onChangeWeight/
// onChangeReps/onRemove are plain inline closures, not stabilized via useCallback -- so
// comparing them would never match and defeat the memo entirely. Comparing only the data
// props instead (same reasoning as ExerciseCard's own arePropsEqual) is what actually lets
// typing into one set skip re-rendering every other one. Exported (not just used
// internally), same reasoning as ExerciseCard's own arePropsEqual: its exact equality
// semantics can be unit tested directly and deterministically this way.
export function arePropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.setIndex === next.setIndex &&
    prev.weight === next.weight &&
    prev.reps === next.reps &&
    prev.duration === next.duration &&
    prev.measurementType === next.measurementType &&
    prev.testID === next.testID
  );
}

export const PastSetRow = memo(PastSetRowComponent, arePropsEqual);
