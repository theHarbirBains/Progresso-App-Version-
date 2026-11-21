import { memo } from 'react';
import { View } from 'react-native';
import type { MeasurementType } from '../exercises/movementTypes';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';
import { SetNumber } from './SetNumber';
import { PastSetRemoveButton } from './SetRowActions';
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
  /** A warm-up set, shown as W: tapping the number marks or unmarks it. */
  warmup?: boolean;
  onToggleWarmup?: () => void;
  /** A drop set under set `setIndex`: shown as an arrow under it, with no number of its own. */
  drop?: boolean;
  accentColor: string;
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
  warmup = false,
  onToggleWarmup,
  drop = false,
  accentColor,
  testID,
}: Props) {
  return (
    <View testID={testID} style={styles.setRow}>
      <SetNumber
        index={setIndex}
        warmup={warmup}
        drop={drop}
        onToggleWarmup={onToggleWarmup}
        accentColor={accentColor}
        testID={testID}
      />
      <SetValueFields
        setId=""
        label={drop ? `Set ${setIndex} drop` : `Set ${setIndex}`}
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
      <PastSetRemoveButton testID={testID} setIndex={setIndex} onRemove={onRemove} drop={drop} />
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
    prev.warmup === next.warmup &&
    prev.drop === next.drop &&
    (prev.onToggleWarmup === undefined) === (next.onToggleWarmup === undefined) &&
    prev.accentColor === next.accentColor &&
    prev.testID === next.testID
  );
}

export const PastSetRow = memo(PastSetRowComponent, arePropsEqual);
