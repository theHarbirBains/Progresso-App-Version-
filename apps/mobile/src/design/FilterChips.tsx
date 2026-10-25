import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from './Text';
import { colors, minTouchTarget, radii, spacing, typeScale } from './theme';
import { useAppTheme } from '../theme/appThemeContext';

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: FilterChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accentColor?: string;
  onAccentColor?: string;
  testID?: string;
}

/**
 * A single-select row of filter chips -- the same 36pt pills (44pt to touch) as the muscle-group
 * filter (exercises/MuscleGroupChips.tsx), filled with the accent when selected, scrolling
 * sideways when they don't fit. For a filter with more options than a SegmentedControl holds.
 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  accentColor: accentColorProp,
  onAccentColor: onAccentColorProp,
  testID,
}: Props<T>) {
  const themeAccent = useAppTheme().accent;
  const accentColor = accentColorProp ?? themeAccent.accent;
  const onAccentColor = onAccentColorProp ?? themeAccent.onAccent;
  return (
    <ScrollView
      testID={testID}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            testID={testID ? `${testID}-${option.value}` : undefined}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: accentColor, borderColor: accentColor }
                : { borderColor: colors.border },
            ]}
            onPress={() => onChange(option.value)}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
          >
            <Text
              style={[styles.chipText, { color: selected ? onAccentColor : colors.textSecondary }]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: spacing.xxl,
  },
  chip: {
    flexShrink: 0,
    minHeight: minTouchTarget - spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    backgroundColor: colors.surfaceRaised,
  },
  chipText: {
    ...typeScale.callout,
    fontFamily: typeScale.label.fontFamily,
    flexShrink: 0,
  },
});
