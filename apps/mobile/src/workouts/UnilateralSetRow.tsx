import { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { colors } from '../design/theme';
import type { MeasurementType } from '../exercises/movementTypes';
import { formatDuration } from '../lib/duration';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';
import { stopSetTimer, useSetTimer } from './setTimers';
import { SetValueFields } from './SetValueFields';

export interface UnilateralSideInput {
  /** The set row id of this side. Handlers receive it, so they need no lookup. */
  id: string;
  weight: string;
  reps: string;
  /** A timed set's duration as typed. */
  duration?: string;
}

interface Props {
  setIndex: number;
  left: UnilateralSideInput;
  right: UnilateralSideInput;
  /** True only once BOTH sides are marked complete -- a unilateral logical
   * set is one unit for completion purposes, not two independent ones. */
  completed: boolean;
  /** Whether BOTH sides currently hold valid values -- gates turning
   * completed on, same convention as SetRow's canComplete. */
  canComplete: boolean;
  /**
   * Stable, set-scoped handlers, taking the side's set id. They must be stable references
   * for the memo below to skip rows that didn't change.
   */
  onChangeWeight: (setId: string, text: string) => void;
  onChangeReps: (setId: string, text: string) => void;
  onChangeDuration?: (setId: string, text: string) => void;
  /** What the exercise measures -- decides which fields show. Defaults to weight and reps. */
  measurementType?: MeasurementType;
  /**
   * Completes or un-completes the whole logical set. Receives the left side's id -- and, when a
   * side's timer was going, the times they stopped at, by set id (SetRow's `timed`).
   */
  onToggleComplete: (setId: string, timed?: Record<string, string>) => void;
  /** Each side of a timed set gets a timer (the live workout only). */
  timer?: boolean;
  /** Removes both sides together -- a unilateral logical set is one unit, same as completion.
   * Receives the left side's id. Omitted where removing a set mid-workout isn't offered. */
  onRemove?: (setId: string) => void;
  accentColor: string;
  onAccentColor: string;
  testID?: string;
}

const SIDES = [
  { key: 'left', tag: 'L', name: 'left' },
  { key: 'right', tag: 'R', name: 'right' },
] as const;

/**
 * One logical set of a unilateral exercise -- e.g. "Set 1" of Bulgarian
 * Split Squat -- rendered as Left and Right rows sharing one set index and
 * one Complete action, rather than two independent SetRows. Weight is
 * always PER SIDE (the "L"/"R" labels make this explicit); the two sides
 * are never added together anywhere in this component. The inputs and the
 * complete button are exactly SetRow's, so a unilateral exercise's sets look
 * like a natural extension of a bilateral one, not a different language.
 *
 * Memoised, like SetRow: typing into one side re-renders only that row.
 */
function UnilateralSetRowComponent({
  setIndex,
  left,
  right,
  completed,
  canComplete,
  onChangeWeight,
  onChangeReps,
  onChangeDuration,
  measurementType = 'weight_reps',
  onToggleComplete,
  onRemove,
  timer = false,
  accentColor,
  onAccentColor,
  testID,
}: Props) {
  const timed = timer && measurementType === 'timed';
  const leftTiming = useSetTimer(left.id);
  const rightTiming = useSetTimer(right.id);
  const canToggle =
    completed || canComplete || (timed && (leftTiming !== undefined || rightTiming !== undefined));
  const values = { left, right };

  function handleComplete() {
    if (!timed || completed) {
      onToggleComplete(left.id);
      return;
    }
    // Finishing: each side's timer stops, and both sides complete at their times.
    const stopped: Record<string, string> = {};
    for (const side of [left, right]) {
      const seconds = stopSetTimer(side.id);
      if (seconds !== null) stopped[side.id] = formatDuration(seconds);
    }
    onToggleComplete(left.id, Object.keys(stopped).length > 0 ? stopped : undefined);
  }

  return (
    <View testID={testID} style={styles.unilateralSetRow}>
      <Text style={styles.setIndex}>{setIndex}</Text>

      <View style={styles.unilateralSideRows}>
        {SIDES.map(({ key, tag, name }) => (
          <View key={key} style={styles.unilateralSideRow}>
            <Text style={styles.unilateralSideLabel}>{tag}</Text>
            <SetValueFields
              setId={values[key].id}
              label={`Set ${setIndex} ${name}`}
              measurementType={measurementType}
              weight={values[key].weight}
              reps={values[key].reps}
              duration={values[key].duration ?? ''}
              completed={completed}
              onChangeWeight={onChangeWeight}
              onChangeReps={onChangeReps}
              onChangeDuration={onChangeDuration}
              timer={timed}
              accentColor={accentColor}
              testID={testID ? `${testID}-${key}` : undefined}
            />
          </View>
        ))}
      </View>

      <TouchableOpacity
        testID={testID ? `${testID}-complete` : undefined}
        style={[
          styles.setCompleteButton,
          {
            borderColor: completed ? accentColor : colors.border,
            backgroundColor: completed ? accentColor : 'transparent',
          },
        ]}
        onPress={handleComplete}
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
          onPress={() => onRemove(left.id)}
          accessibilityRole="button"
          accessibilityLabel={`Remove set ${setIndex}`}
        >
          <Feather name="trash-2" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export const UnilateralSetRow = memo(UnilateralSetRowComponent);
