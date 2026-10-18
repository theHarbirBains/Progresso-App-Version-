import { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { colors } from '../design/theme';
import type { MeasurementType } from '../exercises/movementTypes';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';
import { SetValueFields } from './SetValueFields';

interface Props {
  setId: string;
  setIndex: number;
  weight: string;
  reps: string;
  /** A timed set's duration as typed. */
  duration?: string;
  /** What the exercise measures -- decides which fields show. Defaults to weight and reps. */
  measurementType?: MeasurementType;
  completed: boolean;
  /** Whether weight+reps currently hold valid values -- gates turning
   * completed on (turning it back off is always allowed). */
  canComplete: boolean;
  /**
   * Set-scoped handlers, taking the set's id. They must be stable references (the screen
   * passes functions that only use functional state updates), or the memo below can't skip
   * the rows that didn't change while the user types into one row.
   */
  onChangeWeight: (setId: string, text: string) => void;
  onChangeReps: (setId: string, text: string) => void;
  onChangeDuration?: (setId: string, text: string) => void;
  onToggleComplete: (setId: string) => void;
  /** Omitted where removing a set mid-workout isn't offered (see each caller). */
  onRemove?: (setId: string) => void;
  accentColor: string;
  onAccentColor: string;
  testID?: string;
}

// Every exercise's set list. Weight/reps lock once a set is marked complete
// (un-completing it re-enables editing) -- keeps the common case (glance,
// tap complete, move on) free of accidental edits mid-workout. Built for
// one-handed use: 48pt-tall numeric fields with a large mono readout and a
// 44pt complete button, each field named for assistive tech.
//
// Memoised: typing into one set re-renders only that set. Every prop here is a
// value or a stable handler, so the other rows in the same exercise skip.
function SetRowComponent({
  setId,
  setIndex,
  weight,
  reps,
  duration = '',
  measurementType = 'weight_reps',
  completed,
  canComplete,
  onChangeWeight,
  onChangeReps,
  onChangeDuration,
  onToggleComplete,
  onRemove,
  accentColor,
  onAccentColor,
  testID,
}: Props) {
  const canToggle = completed || canComplete;

  return (
    <View testID={testID} style={styles.setRow}>
      <Text style={styles.setIndex}>{setIndex}</Text>
      <SetValueFields
        setId={setId}
        label={`Set ${setIndex}`}
        measurementType={measurementType}
        weight={weight}
        reps={reps}
        duration={duration}
        completed={completed}
        onChangeWeight={onChangeWeight}
        onChangeReps={onChangeReps}
        onChangeDuration={onChangeDuration}
        testID={testID}
      />
      <TouchableOpacity
        testID={testID ? `${testID}-complete` : undefined}
        style={[
          styles.setCompleteButton,
          {
            borderColor: completed ? accentColor : colors.border,
            backgroundColor: completed ? accentColor : 'transparent',
          },
        ]}
        onPress={() => onToggleComplete(setId)}
        disabled={!canToggle}
        accessibilityRole="button"
        accessibilityState={{ selected: completed, disabled: !canToggle }}
        accessibilityLabel={completed ? 'Mark set incomplete' : 'Mark set complete'}
      >
        <Feather
          name="check"
          size={18}
          color={completed ? onAccentColor : canToggle ? colors.textSecondary : colors.textMuted}
        />
      </TouchableOpacity>
      {onRemove ? (
        <TouchableOpacity
          testID={testID ? `${testID}-remove` : undefined}
          style={styles.setRemoveButton}
          onPress={() => onRemove(setId)}
          accessibilityRole="button"
          accessibilityLabel={`Remove set ${setIndex}`}
        >
          <Feather name="trash-2" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export const SetRow = memo(SetRowComponent);
