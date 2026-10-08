import { memo } from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { colors } from '../design/theme';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';

export interface UnilateralSideInput {
  /** The set row id of this side. Handlers receive it, so they need no lookup. */
  id: string;
  weight: string;
  reps: string;
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
  /** Completes or un-completes the whole logical set. Receives the left side's id. */
  onToggleComplete: (setId: string) => void;
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
  onToggleComplete,
  onRemove,
  accentColor,
  onAccentColor,
  testID,
}: Props) {
  const canToggle = completed || canComplete;
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
              style={[styles.setInput, completed && styles.setInputCompleted]}
              accessibilityLabel={`Set ${setIndex} ${name} weight`}
              keyboardType="decimal-pad"
              value={values[key].weight}
              onChangeText={(text) => onChangeWeight(values[key].id, text)}
              editable={!completed}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              testID={testID ? `${testID}-${key}-reps` : undefined}
              style={[styles.setInput, completed && styles.setInputCompleted]}
              accessibilityLabel={`Set ${setIndex} ${name} reps`}
              keyboardType="number-pad"
              value={values[key].reps}
              onChangeText={(text) => onChangeReps(values[key].id, text)}
              editable={!completed}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
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
        onPress={() => onToggleComplete(left.id)}
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
