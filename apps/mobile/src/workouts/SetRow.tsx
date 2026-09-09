import { TextInput, TouchableOpacity, View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../design/theme';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';

interface Props {
  setIndex: number;
  weight: string;
  reps: string;
  completed: boolean;
  /** Whether weight+reps currently hold valid values -- gates turning
   * completed on (turning it back off is always allowed). */
  canComplete: boolean;
  onChangeWeight: (text: string) => void;
  onChangeReps: (text: string) => void;
  onToggleComplete: () => void;
  accentColor: string;
  onAccentColor: string;
  testID?: string;
}

// Every exercise's set list. Weight/reps lock once a set is marked complete
// (un-completing it re-enables editing) -- keeps the common case (glance,
// tap complete, move on) free of accidental edits mid-workout.
export function SetRow({
  setIndex,
  weight,
  reps,
  completed,
  canComplete,
  onChangeWeight,
  onChangeReps,
  onToggleComplete,
  accentColor,
  onAccentColor,
  testID,
}: Props) {
  const canToggle = completed || canComplete;

  return (
    <View testID={testID} style={styles.setRow}>
      <Text style={styles.setIndex}>{setIndex}</Text>
      <TextInput
        testID={testID ? `${testID}-weight` : undefined}
        style={[styles.setInput, completed && styles.setInputCompleted]}
        keyboardType="decimal-pad"
        value={weight}
        onChangeText={onChangeWeight}
        editable={!completed}
        placeholder="0"
        placeholderTextColor={colors.textMuted}
      />
      <TextInput
        testID={testID ? `${testID}-reps` : undefined}
        style={[styles.setInput, completed && styles.setInputCompleted]}
        keyboardType="number-pad"
        value={reps}
        onChangeText={onChangeReps}
        editable={!completed}
        placeholder="0"
        placeholderTextColor={colors.textMuted}
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
        onPress={onToggleComplete}
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
    </View>
  );
}
