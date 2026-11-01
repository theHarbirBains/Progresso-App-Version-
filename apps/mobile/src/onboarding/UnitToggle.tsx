import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import { useAppTheme } from '../theme/appThemeContext';

interface Props<T extends string> {
  /** The picker's testID; each option is `${testID}-unit-${value}`. */
  testID: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * The unit switch above a wheel picker (kg/lb, cm/ft-in): a pill track with the chosen unit
 * filled in the app theme's accent.
 */
export function UnitToggle<T extends string>({ testID, options, value, onChange }: Props<T>) {
  const { accent } = useAppTheme();
  return (
    <View style={styles.unitToggle}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            testID={`${testID}-unit-${option.value}`}
            style={[styles.unitOption, selected && { backgroundColor: accent.accent }]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.unitText, selected && { color: accent.onAccent }]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** What the wheel pickers share around their wheels: centred, with the value read out beneath. */
export const wheelPickerStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  preview: {
    ...typeScale.secondary,
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontFamily: fonts.displayMedium,
  },
});

const styles = StyleSheet.create({
  unitToggle: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  unitOption: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
  },
  unitText: {
    ...typeScale.callout,
    color: colors.textSecondary,
    fontFamily: fonts.display,
  },
});
