import { TextInput, View } from 'react-native';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import type { MeasurementType } from '../exercises/movementTypes';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';

interface Props {
  setId: string;
  /** Names the fields for assistive tech: "Set 2", "Set 2 left". */
  label: string;
  measurementType: MeasurementType;
  weight: string;
  reps: string;
  duration: string;
  /** A completed set's fields are locked, and drawn as completed. */
  completed: boolean;
  onChangeWeight: (setId: string, text: string) => void;
  onChangeReps: (setId: string, text: string) => void;
  onChangeDuration?: (setId: string, text: string) => void;
  /** Prefix for the fields' test ids: `${testID}-weight`, `-reps`, `-time`. */
  testID?: string;
}

/**
 * A set's input fields, for what its exercise measures, in the two columns every set row
 * shares: weight and reps; "BW" and reps for a bodyweight exercise (reps only, so its reps
 * line up with a weighted exercise's); or one time field across both columns for a timed
 * one, typed as seconds or minutes:seconds. Shared by every set row, live or past.
 */
export function SetValueFields({
  setId,
  label,
  measurementType,
  weight,
  reps,
  duration,
  completed,
  onChangeWeight,
  onChangeReps,
  onChangeDuration,
  testID,
}: Props) {
  const fieldStyle = [styles.setInput, completed && styles.setInputCompleted];

  if (measurementType === 'timed') {
    return (
      <TextInput
        testID={testID ? `${testID}-time` : undefined}
        style={[...fieldStyle, styles.setInputWide]}
        accessibilityLabel={`${label} time, in seconds or minutes and seconds`}
        keyboardType="numbers-and-punctuation"
        value={duration}
        onChangeText={(text) => onChangeDuration?.(setId, text)}
        editable={!completed}
        placeholder="0:00"
        placeholderTextColor={colors.textMuted}
      />
    );
  }

  const repsField = (
    <TextInput
      testID={testID ? `${testID}-reps` : undefined}
      style={fieldStyle}
      accessibilityLabel={`${label} reps`}
      keyboardType="number-pad"
      value={reps}
      onChangeText={(text) => onChangeReps(setId, text)}
      editable={!completed}
      placeholder="0"
      placeholderTextColor={colors.textMuted}
    />
  );

  if (measurementType === 'bodyweight') {
    return (
      <>
        <View
          testID={testID ? `${testID}-bodyweight` : undefined}
          style={styles.setBodyweightCell}
          accessible
          accessibilityLabel={`${label}: bodyweight`}
        >
          <Text style={styles.setBodyweightText}>BW</Text>
        </View>
        {repsField}
      </>
    );
  }

  return (
    <>
      <TextInput
        testID={testID ? `${testID}-weight` : undefined}
        style={fieldStyle}
        accessibilityLabel={`${label} weight`}
        keyboardType="decimal-pad"
        value={weight}
        onChangeText={(text) => onChangeWeight(setId, text)}
        editable={!completed}
        placeholder="0"
        placeholderTextColor={colors.textMuted}
      />
      {repsField}
    </>
  );
}
