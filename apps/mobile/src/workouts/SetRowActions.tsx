import { Feather } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { colors } from '../design/theme';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';

// The buttons at the end of a set row: the live workout's check and remove
// (SetRow, UnilateralSetRow), and a past workout's remove (PastSetRow,
// PastUnilateralSetRow), which takes the check's place since every set typed
// in there already happened.

export const SIDES = [
  { key: 'left', tag: 'L', name: 'left' },
  { key: 'right', tag: 'R', name: 'right' },
] as const;

interface LiveProps {
  testID?: string;
  setIndex: number;
  completed: boolean;
  /** Whether the check can be pressed: always to un-complete, to complete once it can be. */
  canToggle: boolean;
  onComplete: () => void;
  /** Omitted where removing a set mid-workout isn't offered. */
  onRemove?: () => void;
  accentColor: string;
  onAccentColor: string;
}

/** A live set's 44pt check, filled with the accent once done, and its remove button. */
export function LiveSetActions({
  testID,
  setIndex,
  completed,
  canToggle,
  onComplete,
  onRemove,
  accentColor,
  onAccentColor,
}: LiveProps) {
  return (
    <>
      <TouchableOpacity
        testID={testID ? `${testID}-complete` : undefined}
        style={[
          styles.setCompleteButton,
          {
            borderColor: completed ? accentColor : colors.border,
            backgroundColor: completed ? accentColor : 'transparent',
          },
        ]}
        onPress={onComplete}
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
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove set ${setIndex}`}
        >
          <Feather name="trash-2" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </>
  );
}

/** A past set's remove button, where a live set has its check. */
export function PastSetRemoveButton({
  testID,
  setIndex,
  onRemove,
}: {
  testID?: string;
  setIndex: number;
  onRemove: () => void;
}) {
  return (
    <TouchableOpacity
      testID={testID ? `${testID}-remove` : undefined}
      style={styles.setCompleteButton}
      onPress={onRemove}
      accessibilityRole="button"
      accessibilityLabel={`Remove set ${setIndex}`}
    >
      <Feather name="trash-2" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}
