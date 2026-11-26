import { Feather } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';
import { Text } from './Text';
import { colors, minTouchTarget, radii, spacing, typeScale } from './theme';

const PILL_HEIGHT = minTouchTarget - 8;

/**
 * One filter, as a compact pill: what it's set to (or its name, "All Muscles"), with a chevron,
 * opening its choices in a sheet. Set, it's outlined and tinted in the accent. Drawn 36pt tall,
 * its touch reaching the full 44pt -- the Split Library's filters and the Exercise Library's.
 */
export function FilterPill({
  label,
  active,
  onPress,
  accentColor,
  accessibilityLabel,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  /** The accent when set; the app theme's by default. */
  accentColor?: string;
  accessibilityLabel?: string;
  testID: string;
}) {
  const { accent } = useAppTheme();
  const tint = accentColor ?? accent.accent;
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={[styles.pill, active && { borderColor: tint, backgroundColor: withAlpha(tint, 0.14) }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${label}. Change`}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.pillText, active && { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
      <Feather name="chevron-down" size={14} color={active ? tint : colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: PILL_HEIGHT,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
  },
  pillText: {
    ...typeScale.label,
    color: colors.textSecondaryBright,
  },
});
