import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { colors, radii, typeScale } from '../design/theme';
import { liveWorkoutStyles } from '../screens/liveWorkoutStyles';
import { withAlpha } from '../theme/accentColor';

interface Props {
  index: number;
  /** A warm-up set: shown as "W", counted toward nothing. */
  warmup?: boolean;
  /** Marks or unmarks the set as a warm-up; without it the number is plain text. */
  onToggleWarmup?: () => void;
  accentColor: string;
  testID?: string;
}

/**
 * A set's number at the start of its row. In a live workout it's also how a set is marked a
 * warm-up: tapped, it turns into a small "W" on a soft tint of the accent -- quiet, but clear at a
 * glance -- and tapped again it's a working set. A faint ring shows it can be tapped.
 */
export function SetNumber({ index, warmup = false, onToggleWarmup, accentColor, testID }: Props) {
  if (!onToggleWarmup) return <Text style={liveWorkoutStyles.setIndex}>{index}</Text>;
  return (
    <TouchableOpacity
      testID={testID ? `${testID}-number` : undefined}
      onPress={onToggleWarmup}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: warmup }}
      accessibilityLabel={warmup ? `Set ${index}, warm-up` : `Set ${index}`}
      accessibilityHint={warmup ? 'Makes it a working set' : 'Marks it as a warm-up'}
      style={styles.slot}
    >
      <View
        style={[
          styles.chip,
          warmup
            ? {
                backgroundColor: withAlpha(accentColor, 0.16),
                borderColor: withAlpha(accentColor, 0.45),
              }
            : styles.plain,
        ]}
      >
        <Text style={[styles.label, warmup && { color: accentColor }]}>{warmup ? 'W' : index}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: 28,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  chip: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 4,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plain: {
    borderColor: colors.border,
  },
  label: {
    ...typeScale.statSmall,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
