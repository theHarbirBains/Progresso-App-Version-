import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './Text';
import { GlassBackground } from './GlassBackground';
import { colors, fonts, radii, spacing, typeScale } from './theme';

interface Option<T extends string> {
  label: string;
  value: T;
  /** Read by assistive tech instead of `label` -- for an abbreviated visible label ("4W"). */
  accessibilityLabel?: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  /** null renders every segment unselected -- for a choice that genuinely has no default yet (e.g. a required field the user hasn't answered). */
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Defaults to colors.accent -- pass a contextual Workout/Nutrition accent where relevant. */
  accentColor?: string;
  onAccentColor?: string;
  testID?: string;
}

// Component Logic: one pill-shaped row of equal-weight segments, generalizing
// the kg/lb and cm/ft-in toggles that were previously hand-rolled three
// separate times -- generic `options`/`value`/`onChange` rather than any
// weight/height-specific terminology, so any small choose-one set can use it.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
  accentColor = colors.accent,
  onAccentColor = colors.onAccent,
  testID,
}: Props<T>) {
  return (
    <View testID={testID} style={[styles.track, disabled && styles.disabled]}>
      <GlassBackground />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            testID={testID ? `${testID}-${option.value}` : undefined}
            style={[styles.segment, selected && { backgroundColor: accentColor }]}
            onPress={() => !disabled && onChange(option.value)}
            disabled={disabled}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: Boolean(disabled) }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
          >
            <Text style={[styles.label, selected && { color: onAccentColor }]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    padding: 4,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.5,
  },
  // 36 + the track's own 4pt padding top and bottom = the 44pt minimum touch
  // target (theme.minTouchTarget), so a segment is comfortable to hit without
  // the control looking any taller than it did.
  segment: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
  },
  label: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
  },
});
