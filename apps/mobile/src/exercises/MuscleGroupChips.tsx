import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '../design/Text';
import { colors, minTouchTarget, radii, spacing, typeScale } from '../design/theme';
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type MuscleGroup } from './muscleGroups';

interface Props {
  value: MuscleGroup | null;
  onChange: (value: MuscleGroup | null) => void;
  /** Adds a leading "All" chip that clears the filter (null). */
  includeAll?: boolean;
  /** Selected-chip fill/text color. Defaults to the brand accent; every call site that has one passes the user's Workout accent so the selected chip follows it. */
  accentColor?: string;
  onAccentColor?: string;
  /** Border/text color for the UNSELECTED chip. Default to the theme's border / secondary text. */
  chipBorderColor?: string;
  chipTextColor?: string;
}

// The muscle-group picker shared by the Exercise Library filter (includeAll),
// the create/edit form's required single-select, the Add Exercise picker and
// the Progress filters. Chips ARE controls (a single-select), so they are 36pt
// pills with a 44pt touch area, filled with the accent when selected.
//
// Layout guards (a regression made these chips collapse once, DESIGN.md §12):
// the row is a horizontal ScrollView with `flexGrow: 0` and `alignItems:
// 'center'` so its cross-axis never stretches the chips; each chip has an
// explicit minHeight, is centred, and never shrinks.
export function MuscleGroupChips({
  value,
  onChange,
  includeAll = false,
  accentColor = colors.accent,
  onAccentColor = colors.onAccent,
  chipBorderColor = colors.border,
  chipTextColor = colors.textSecondary,
}: Props) {
  const options: (MuscleGroup | null)[] = includeAll
    ? [null, ...MUSCLE_GROUPS]
    : [...MUSCLE_GROUPS];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {options.map((option) => {
        const selected = option === value;
        const label = option === null ? 'All' : MUSCLE_GROUP_LABELS[option];
        return (
          <TouchableOpacity
            key={option ?? 'all'}
            testID={`muscle-group-chip-${option ?? 'all'}`}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: accentColor, borderColor: accentColor }
                : { borderColor: chipBorderColor },
            ]}
            onPress={() => onChange(option)}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
          >
            <Text style={[styles.chipText, { color: selected ? onAccentColor : chipTextColor }]}>
              {label}
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
