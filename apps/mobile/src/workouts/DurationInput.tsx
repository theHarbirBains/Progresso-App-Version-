import { StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../design/Text';
import { colors, minTouchTarget, radii, spacing, typeScale } from '../design/theme';

interface Props {
  hours: string;
  minutes: string;
  onChangeHours: (text: string) => void;
  onChangeMinutes: (text: string) => void;
  testID?: string;
}

// An optional "how long did this take" field for a workout logged after the
// fact (LogPastWorkoutScreen) or corrected later (EditWorkoutScreen) --
// there's no live timer to derive it from the way ActiveWorkoutScreen has.
// Two small boxes (hours, minutes), same bordered-box convention as
// PastSetRow's weight/reps inputs. Left blank (both empty/zero), the
// workout's duration reads "--" everywhere (WorkoutStats, WorkoutDetail,
// Workout History) exactly as it already does today -- this never forces a
// fabricated number.
export function DurationInput({ hours, minutes, onChangeHours, onChangeMinutes, testID }: Props) {
  return (
    <View testID={testID}>
      <Text style={styles.label}>Duration (optional)</Text>
      <View style={styles.row}>
        <View style={styles.field}>
          <TextInput
            testID={testID ? `${testID}-hours` : undefined}
            style={styles.input}
            accessibilityLabel="Duration, hours"
            keyboardType="number-pad"
            value={hours}
            onChangeText={onChangeHours}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.unit}>hr</Text>
        </View>
        <View style={styles.field}>
          <TextInput
            testID={testID ? `${testID}-minutes` : undefined}
            style={styles.input}
            accessibilityLabel="Duration, minutes"
            keyboardType="number-pad"
            value={minutes}
            onChangeText={onChangeMinutes}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.unit}>min</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typeScale.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    height: minTouchTarget + spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.textPrimary,
    ...typeScale.statMedium,
    textAlign: 'center',
  },
  unit: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
});
