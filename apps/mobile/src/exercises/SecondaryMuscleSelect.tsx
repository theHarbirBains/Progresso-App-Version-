import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { colors, minTouchTarget, radii, spacing, typeScale } from '../design/theme';
import { useAppTheme } from '../theme/appThemeContext';
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type MuscleGroup } from './muscleGroups';

/** The groups an exercise can also work: every group but Full Body and Other. */
export const SECONDARY_CHOICES: readonly MuscleGroup[] = MUSCLE_GROUPS.filter(
  (group) => group !== 'full_body' && group !== 'other',
);

interface Props {
  /** Its own muscle group, left out of the choices. */
  primary: MuscleGroup | null;
  value: readonly MuscleGroup[];
  onChange: (value: MuscleGroup[]) => void;
  accentColor?: string;
  onAccentColor?: string;
  testID?: string;
}

/**
 * Create Exercise's "Also Works": the muscle groups a custom exercise trains besides its own, any
 * number of them, as pills that wrap (FilterChips' look, filled with the accent once chosen) --
 * tapped to choose, tapped again to leave out. They show on its page and count on the person's
 * heat map. Its own muscle group is never one of them.
 */
export function SecondaryMuscleSelect({
  primary,
  value,
  onChange,
  accentColor: accentColorProp,
  onAccentColor: onAccentColorProp,
  testID = 'secondary-muscles',
}: Props) {
  const themeAccent = useAppTheme().accent;
  const accentColor = accentColorProp ?? themeAccent.accent;
  const onAccentColor = onAccentColorProp ?? themeAccent.onAccent;
  const choices = SECONDARY_CHOICES.filter((group) => group !== primary);
  return (
    <View testID={testID}>
      <Text style={styles.fieldLabel}>Also Works (Optional)</Text>
      <View style={styles.chips}>
        {choices.map((group) => {
          const selected = value.includes(group);
          return (
            <TouchableOpacity
              key={group}
              testID={`${testID}-${group}`}
              style={[
                styles.chip,
                selected
                  ? { backgroundColor: accentColor, borderColor: accentColor }
                  : { borderColor: colors.border },
              ]}
              onPress={() =>
                onChange(
                  selected
                    ? value.filter((chosen) => chosen !== group)
                    : SECONDARY_CHOICES.filter((g) => g === group || value.includes(g)),
                )
              }
              hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
              accessibilityRole="button"
              accessibilityLabel={`Also works ${MUSCLE_GROUP_LABELS[group]}`}
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? onAccentColor : colors.textSecondary },
                ]}
              >
                {MUSCLE_GROUP_LABELS[group]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.helperText}>
        The muscles it trains besides its main one. They count on your heat map.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    ...typeScale.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
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
  },
  helperText: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
